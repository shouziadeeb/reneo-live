import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import AgoraRTC, {
  type IAgoraRTCClient,
  type IAgoraRTCRemoteUser,
  type ICameraVideoTrack,
  type IMicrophoneAudioTrack,
  type IRemoteAudioTrack,
  type IRemoteVideoTrack,
} from 'agora-rtc-sdk-ng'
import { AgoraTokenError, fetchAgoraToken, uidFromUserId } from '../lib/agora'
import type { InteractionMode } from '../types'

AgoraRTC.setLogLevel(3)

export type AgoraRole = 'host' | 'audience'

export interface RemoteParticipantMedia {
  uid: number
  hasAudio: boolean
  hasVideo: boolean
  isSessionHost: boolean
}

interface UseAgoraOptions {
  liveId: string | null
  /** Initial join role. Session host joins as host; viewers join as audience. */
  role: AgoraRole
  enabled: boolean
  /** Profile id of the live session host — used to pin the main broadcast tile. */
  hostUserId?: string | null
}

interface UseAgoraResult {
  localVideoRef: RefObject<HTMLDivElement | null>
  remoteVideoRef: RefObject<HTMLDivElement | null>
  /** Container refs keyed by remote uid for co-host video tiles. */
  bindRemoteVideoEl: (uid: number, el: HTMLDivElement | null) => void
  connecting: boolean
  connected: boolean
  error: string | null
  warning: string | null
  micMuted: boolean
  cameraOff: boolean
  viewerCount: number | null
  reconnecting: boolean
  needsTapToPlay: boolean
  /** Current Agora client role after any in-channel promotion/demotion. */
  clientRole: AgoraRole
  publishing: boolean
  publishError: string | null
  remoteParticipants: RemoteParticipantMedia[]
  toggleMic: () => Promise<void>
  toggleCamera: () => Promise<void>
  switchCamera: () => Promise<void>
  leave: () => Promise<void>
  retry: () => void
  resumePlayback: () => void
  canSwitchCamera: boolean
  /**
   * Explicit consent path: renew publisher token → setClientRole(host) →
   * create tracks → publish. Never called implicitly on accept/invite.
   */
  publishAsParticipant: (mode: InteractionMode) => Promise<void>
  /** Unpublish local media and return to audience without leaving the channel. */
  unpublishAsParticipant: () => Promise<void>
}

function isPermissionDenied(error: unknown): boolean {
  const err = error as { name?: string; code?: string; message?: string }
  const blob = `${err.name ?? ''} ${err.code ?? ''} ${err.message ?? ''}`.toLowerCase()
  return (
    err.name === 'NotAllowedError' ||
    blob.includes('permission') ||
    blob.includes('notallowed') ||
    blob.includes('denied')
  )
}

function isDeviceMissing(error: unknown): boolean {
  const err = error as { name?: string; code?: string; message?: string }
  const blob = `${err.name ?? ''} ${err.code ?? ''} ${err.message ?? ''}`.toLowerCase()
  return (
    err.name === 'NotFoundError' ||
    blob.includes('device not found') ||
    blob.includes('notfound') ||
    blob.includes('requested device not found')
  )
}

function cameraErrorMessage(error: unknown): string {
  if (isPermissionDenied(error)) {
    return 'Camera permission was denied. Please enable camera access in your browser settings.'
  }
  if (isDeviceMissing(error)) {
    return 'No camera was found on this device. Connect a camera and retry.'
  }
  const message = error instanceof Error ? error.message : String(error)
  return message || 'Could not start the camera.'
}

function microphoneErrorMessage(error: unknown): string {
  if (isPermissionDenied(error)) {
    return 'Microphone permission was denied. Enable microphone access in your browser or device settings, then retry.'
  }
  if (isDeviceMissing(error)) {
    return 'No microphone was found. Connect a microphone or check that it is not in use by another app, then retry.'
  }
  const message = error instanceof Error ? error.message : String(error)
  return message || 'Could not start the microphone.'
}

function friendlyAgoraError(error: unknown): string {
  if (error instanceof AgoraTokenError) {
    return error.message
  }

  const err = error as { name?: string; code?: string | number; message?: string }
  const message = err.message || (error instanceof Error ? error.message : String(error))
  const blob = `${err.name ?? ''} ${err.code ?? ''} ${message}`.toLowerCase()

  if (isPermissionDenied(error)) {
    return 'Camera or microphone permission was denied. Please enable access in your browser settings.'
  }
  if (isDeviceMissing(error)) {
    return 'No camera or microphone was found on this device.'
  }
  if (blob.includes('token') || blob.includes('invalid vendor key') || blob.includes('can_not_get_gateway')) {
    return 'Could not authorize the live stream. Please retry. If this continues, sign out and sign back in.'
  }
  if (
    blob.includes('network') ||
    blob.includes('timeout') ||
    blob.includes('disconnected') ||
    blob.includes('websocket') ||
    blob.includes('offline')
  ) {
    return 'Network issue while connecting to the live stream. Check your connection and retry.'
  }
  return message || 'Failed to connect to the live stream.'
}

function syncRemoteParticipants(
  client: IAgoraRTCClient,
  hostUid: number | null,
  setRemoteParticipants: (next: RemoteParticipantMedia[]) => void,
) {
  const next: RemoteParticipantMedia[] = client.remoteUsers.map((user) => ({
    uid: Number(user.uid),
    hasAudio: Boolean(user.hasAudio),
    hasVideo: Boolean(user.hasVideo),
    isSessionHost: hostUid != null && Number(user.uid) === hostUid,
  }))
  setRemoteParticipants(next)
}

export function useAgora({
  liveId,
  role,
  enabled,
  hostUserId = null,
}: UseAgoraOptions): UseAgoraResult {
  const localVideoRef = useRef<HTMLDivElement | null>(null)
  const remoteVideoRef = useRef<HTMLDivElement | null>(null)
  const remoteTileElsRef = useRef<Map<number, HTMLDivElement>>(new Map())
  const clientRef = useRef<IAgoraRTCClient | null>(null)
  const micTrackRef = useRef<IMicrophoneAudioTrack | null>(null)
  const camTrackRef = useRef<ICameraVideoTrack | null>(null)
  const remoteAudioTracksRef = useRef<Map<number, IRemoteAudioTrack>>(new Map())
  const remoteVideoTracksRef = useRef<Map<number, IRemoteVideoTrack>>(new Map())
  const hostUidRef = useRef<number | null>(hostUserId ? uidFromUserId(hostUserId) : null)
  const initialRoleRef = useRef<AgoraRole>(role)

  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [micMuted, setMicMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [viewerCount, setViewerCount] = useState<number | null>(null)
  const [canSwitchCamera, setCanSwitchCamera] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [reconnecting, setReconnecting] = useState(false)
  const [needsTapToPlay, setNeedsTapToPlay] = useState(false)
  const [clientRole, setClientRole] = useState<AgoraRole>(role)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipantMedia[]>([])

  useEffect(() => {
    hostUidRef.current = hostUserId ? uidFromUserId(hostUserId) : null
    initialRoleRef.current = role
  }, [hostUserId, role])

  const playRemoteVideo = useCallback((uid: number, track: IRemoteVideoTrack) => {
    const hostUid = hostUidRef.current
    const isHost = hostUid != null && uid === hostUid
    const el = isHost
      ? remoteVideoRef.current
      : remoteTileElsRef.current.get(uid) ?? null
    if (el) {
      track.play(el)
    }
  }, [])

  const bindRemoteVideoEl = useCallback(
    (uid: number, el: HTMLDivElement | null) => {
      if (el) {
        remoteTileElsRef.current.set(uid, el)
        const track = remoteVideoTracksRef.current.get(uid)
        if (track) track.play(el)
      } else {
        remoteTileElsRef.current.delete(uid)
      }
    },
    [],
  )

  const cleanupLocalTracks = useCallback(async () => {
    micTrackRef.current?.stop()
    micTrackRef.current?.close()
    micTrackRef.current = null

    camTrackRef.current?.stop()
    camTrackRef.current?.close()
    camTrackRef.current = null

    if (localVideoRef.current) localVideoRef.current.innerHTML = ''
    setMicMuted(false)
    setCameraOff(false)
    setCanSwitchCamera(false)
    setPublishing(false)
  }, [])

  const cleanupRemoteMedia = useCallback(() => {
    for (const track of remoteAudioTracksRef.current.values()) {
      track.stop()
    }
    remoteAudioTracksRef.current.clear()

    for (const track of remoteVideoTracksRef.current.values()) {
      track.stop()
    }
    remoteVideoTracksRef.current.clear()

    if (remoteVideoRef.current) remoteVideoRef.current.innerHTML = ''
    setRemoteParticipants([])
  }, [])

  const leave = useCallback(async () => {
    const client = clientRef.current
    try {
      if (client) {
        await client.unpublish().catch(() => undefined)
        await client.leave()
      }
    } finally {
      await cleanupLocalTracks()
      cleanupRemoteMedia()
      clientRef.current = null
      setConnected(false)
      setConnecting(false)
      setViewerCount(null)
      setReconnecting(false)
      setNeedsTapToPlay(false)
      setClientRole(initialRoleRef.current)
      setPublishError(null)
    }
  }, [cleanupLocalTracks, cleanupRemoteMedia])

  const retry = useCallback(() => {
    setError(null)
    setWarning(null)
    setPublishError(null)
    setRetryKey((key) => key + 1)
  }, [])

  const resumePlayback = useCallback(() => {
    for (const track of remoteAudioTracksRef.current.values()) {
      track.play()
    }
    for (const [uid, track] of remoteVideoTracksRef.current.entries()) {
      playRemoteVideo(uid, track)
    }
    if (camTrackRef.current && localVideoRef.current) {
      camTrackRef.current.play(localVideoRef.current)
    }
    setNeedsTapToPlay(false)
  }, [playRemoteVideo])

  useEffect(() => {
    if (!enabled || !liveId) return

    let cancelled = false

    async function join() {
      setConnecting(true)
      setError(null)
      setWarning(null)
      setPublishError(null)
      setReconnecting(false)
      setNeedsTapToPlay(false)
      setClientRole(role)
      setRemoteParticipants([])

      try {
        const tokenPayload = await fetchAgoraToken(liveId!, role)
        if (cancelled) return

        const client = AgoraRTC.createClient({
          mode: 'live',
          codec: 'vp8',
        })
        clientRef.current = client

        await client.setClientRole(role === 'host' ? 'host' : 'audience')

        const refreshRemotes = () => {
          if (!clientRef.current) return
          syncRemoteParticipants(clientRef.current, hostUidRef.current, setRemoteParticipants)
          setViewerCount(clientRef.current.remoteUsers.length + 1)
        }

        client.on('user-published', async (user: IAgoraRTCRemoteUser, mediaType) => {
          await client.subscribe(user, mediaType)
          const uid = Number(user.uid)

          if (mediaType === 'video' && user.videoTrack) {
            remoteVideoTracksRef.current.set(uid, user.videoTrack)
            playRemoteVideo(uid, user.videoTrack)
          }
          if (mediaType === 'audio' && user.audioTrack) {
            remoteAudioTracksRef.current.set(uid, user.audioTrack)
            user.audioTrack.play()
          }
          refreshRemotes()
        })

        client.on('user-unpublished', (user, mediaType) => {
          const uid = Number(user.uid)
          if (mediaType === 'video') {
            remoteVideoTracksRef.current.get(uid)?.stop()
            remoteVideoTracksRef.current.delete(uid)
            const hostUid = hostUidRef.current
            if (hostUid != null && uid === hostUid && remoteVideoRef.current) {
              remoteVideoRef.current.innerHTML = ''
            }
            const tile = remoteTileElsRef.current.get(uid)
            if (tile) tile.innerHTML = ''
          }
          if (mediaType === 'audio') {
            remoteAudioTracksRef.current.get(uid)?.stop()
            remoteAudioTracksRef.current.delete(uid)
          }
          refreshRemotes()
        })

        client.on('user-joined', refreshRemotes)
        client.on('user-left', (user) => {
          const uid = Number(user.uid)
          remoteAudioTracksRef.current.get(uid)?.stop()
          remoteAudioTracksRef.current.delete(uid)
          remoteVideoTracksRef.current.get(uid)?.stop()
          remoteVideoTracksRef.current.delete(uid)
          refreshRemotes()
        })

        client.on(
          'connection-state-change',
          (cur: string, _prev: string, reason?: string) => {
            if (cancelled) return
            if (cur === 'RECONNECTING' || cur === 'DISCONNECTING') {
              setReconnecting(true)
            } else if (cur === 'CONNECTED') {
              setReconnecting(false)
            } else if (cur === 'DISCONNECTED') {
              setReconnecting(false)
              if (reason && reason !== 'LEAVE') {
                setError(
                  'Connection to the live stream was lost. Check your network and retry.',
                )
                setConnected(false)
              }
            }
          },
        )

        AgoraRTC.onAutoplayFailed = () => {
          if (!cancelled) setNeedsTapToPlay(true)
        }

        await client.join(
          tokenPayload.appId,
          tokenPayload.channel,
          tokenPayload.token,
          tokenPayload.uid,
        )

        if (cancelled) {
          await client.leave()
          return
        }

        // Subscribe to anyone already publishing (host joined first case).
        for (const user of client.remoteUsers) {
          if (user.hasVideo) {
            await client.subscribe(user, 'video')
            if (user.videoTrack) {
              const uid = Number(user.uid)
              remoteVideoTracksRef.current.set(uid, user.videoTrack)
              playRemoteVideo(uid, user.videoTrack)
            }
          }
          if (user.hasAudio) {
            await client.subscribe(user, 'audio')
            if (user.audioTrack) {
              remoteAudioTracksRef.current.set(Number(user.uid), user.audioTrack)
              user.audioTrack.play()
            }
          }
        }

        if (role === 'host') {
          let camTrack: ICameraVideoTrack | null = null
          let micTrack: IMicrophoneAudioTrack | null = null
          let cameraFailure: unknown
          let micFailure: unknown

          try {
            camTrack = await AgoraRTC.createCameraVideoTrack()
          } catch (err) {
            cameraFailure = err
          }

          try {
            micTrack = await AgoraRTC.createMicrophoneAudioTrack()
          } catch (err) {
            micFailure = err
          }

          if (cancelled) {
            camTrack?.close()
            micTrack?.close()
            await client.leave()
            return
          }

          if (cameraFailure) {
            micTrack?.close()
            await client.leave()
            throw new Error(cameraErrorMessage(cameraFailure))
          }

          camTrackRef.current = camTrack
          if (localVideoRef.current && camTrack) {
            camTrack.play(localVideoRef.current)
          }

          const toPublish: Array<ICameraVideoTrack | IMicrophoneAudioTrack> = []
          if (camTrack) toPublish.push(camTrack)

          if (micFailure) {
            setWarning(microphoneErrorMessage(micFailure))
          } else if (micTrack) {
            micTrackRef.current = micTrack
            toPublish.push(micTrack)
          }

          if (toPublish.length > 0) {
            await client.publish(toPublish)
            setPublishing(true)
          }

          const cameras = await AgoraRTC.getCameras().catch(() => [])
          setCanSwitchCamera(cameras.length > 1)
        }

        refreshRemotes()
        setConnected(true)
      } catch (err) {
        if (!cancelled) {
          setError(friendlyAgoraError(err))
          await leave()
        }
      } finally {
        if (!cancelled) setConnecting(false)
      }
    }

    void join()

    return () => {
      cancelled = true
      AgoraRTC.onAutoplayFailed = () => undefined
      void leave()
    }
  }, [enabled, liveId, role, leave, retryKey, playRemoteVideo])

  useEffect(() => {
    function handleOffline() {
      setReconnecting(true)
    }
    function handleOnline() {
      if (clientRef.current) {
        setReconnecting(false)
      }
    }
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  const toggleMic = useCallback(async () => {
    const track = micTrackRef.current
    if (!track || !publishing) return
    const next = !micMuted
    await track.setEnabled(!next)
    setMicMuted(next)
  }, [micMuted, publishing])

  const toggleCamera = useCallback(async () => {
    const track = camTrackRef.current
    if (!track || !publishing) return
    const next = !cameraOff
    await track.setEnabled(!next)
    setCameraOff(next)
  }, [cameraOff, publishing])

  const switchCamera = useCallback(async () => {
    const track = camTrackRef.current
    if (!track || !publishing || !canSwitchCamera) return
    const cameras = await AgoraRTC.getCameras()
    if (cameras.length < 2) return
    const currentId = track.getTrackLabel()
    const currentIndex = cameras.findIndex((camera) => camera.label === currentId)
    const nextCamera = cameras[(currentIndex + 1) % cameras.length]
    if (nextCamera?.deviceId) {
      await track.setDevice(nextCamera.deviceId)
    }
  }, [canSwitchCamera, publishing])

  const publishAsParticipant = useCallback(
    async (mode: InteractionMode) => {
      const client = clientRef.current
      if (!client || !liveId) {
        throw new Error('Not connected to the live stream.')
      }
      if (initialRoleRef.current === 'host') {
        throw new Error('Session host is already publishing.')
      }

      setPublishError(null)
      setWarning(null)

      try {
        // 1) Server must authorize a publisher token (checks live_interactions).
        const tokenPayload = await fetchAgoraToken(liveId, 'host')
        await client.renewToken(tokenPayload.token)

        // 2) Upgrade in-channel role — do NOT leave/rejoin (keeps main broadcast stable).
        await client.setClientRole('host')
        setClientRole('host')

        let micTrack: IMicrophoneAudioTrack | null = null
        let camTrack: ICameraVideoTrack | null = null

        try {
          micTrack = await AgoraRTC.createMicrophoneAudioTrack()
        } catch (err) {
          throw new Error(microphoneErrorMessage(err))
        }

        if (mode === 'audio_video') {
          try {
            camTrack = await AgoraRTC.createCameraVideoTrack()
          } catch (err) {
            micTrack.close()
            throw new Error(cameraErrorMessage(err))
          }
        }

        micTrackRef.current = micTrack
        camTrackRef.current = camTrack

        if (camTrack && localVideoRef.current) {
          camTrack.play(localVideoRef.current)
        }

        const toPublish: Array<IMicrophoneAudioTrack | ICameraVideoTrack> = [micTrack]
        if (camTrack) toPublish.push(camTrack)
        await client.publish(toPublish)

        setPublishing(true)
        setMicMuted(false)
        setCameraOff(false)

        if (camTrack) {
          const cameras = await AgoraRTC.getCameras().catch(() => [])
          setCanSwitchCamera(cameras.length > 1)
        }
      } catch (err) {
        await cleanupLocalTracks()
        try {
          const audienceToken = await fetchAgoraToken(liveId, 'audience')
          await client.renewToken(audienceToken.token)
          await client.setClientRole('audience')
          setClientRole('audience')
        } catch {
          // stay in safest recoverable UI state
          setClientRole('audience')
        }
        const message = friendlyAgoraError(err)
        setPublishError(message)
        throw new Error(message)
      }
    },
    [cleanupLocalTracks, liveId],
  )

  const unpublishAsParticipant = useCallback(async () => {
    const client = clientRef.current
    if (!client || !liveId) return
    if (initialRoleRef.current === 'host') return

    try {
      const tracks = [micTrackRef.current, camTrackRef.current].filter(
        Boolean,
      ) as Array<IMicrophoneAudioTrack | ICameraVideoTrack>
      if (tracks.length > 0) {
        await client.unpublish(tracks).catch(() => undefined)
      }
      await cleanupLocalTracks()

      // Return to audience in the same channel — no leave/rejoin.
      const audienceToken = await fetchAgoraToken(liveId, 'audience')
      await client.renewToken(audienceToken.token)
      await client.setClientRole('audience')
      setClientRole('audience')
      setPublishError(null)
    } catch (err) {
      setPublishError(friendlyAgoraError(err))
      await cleanupLocalTracks()
      setClientRole('audience')
    }
  }, [cleanupLocalTracks, liveId])

  return {
    localVideoRef,
    remoteVideoRef,
    bindRemoteVideoEl,
    connecting,
    connected,
    error,
    warning,
    micMuted,
    cameraOff,
    viewerCount,
    reconnecting,
    needsTapToPlay,
    clientRole,
    publishing,
    publishError,
    remoteParticipants,
    toggleMic,
    toggleCamera,
    switchCamera,
    leave,
    retry,
    resumePlayback,
    canSwitchCamera,
    publishAsParticipant,
    unpublishAsParticipant,
  }
}
