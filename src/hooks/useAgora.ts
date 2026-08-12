import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import AgoraRTC, {
  type IAgoraRTCClient,
  type ICameraVideoTrack,
  type IMicrophoneAudioTrack,
  type IRemoteAudioTrack,
  type IRemoteVideoTrack,
} from 'agora-rtc-sdk-ng'
import { AgoraTokenError, fetchAgoraToken } from '../lib/agora'

AgoraRTC.setLogLevel(3)

export type AgoraRole = 'host' | 'audience'

interface UseAgoraOptions {
  liveId: string | null
  role: AgoraRole
  enabled: boolean
}

interface UseAgoraResult {
  localVideoRef: RefObject<HTMLDivElement | null>
  remoteVideoRef: RefObject<HTMLDivElement | null>
  connecting: boolean
  connected: boolean
  error: string | null
  warning: string | null
  micMuted: boolean
  cameraOff: boolean
  viewerCount: number | null
  reconnecting: boolean
  needsTapToPlay: boolean
  toggleMic: () => Promise<void>
  toggleCamera: () => Promise<void>
  switchCamera: () => Promise<void>
  leave: () => Promise<void>
  retry: () => void
  resumePlayback: () => void
  canSwitchCamera: boolean
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

export function useAgora({ liveId, role, enabled }: UseAgoraOptions): UseAgoraResult {
  const localVideoRef = useRef<HTMLDivElement | null>(null)
  const remoteVideoRef = useRef<HTMLDivElement | null>(null)
  const clientRef = useRef<IAgoraRTCClient | null>(null)
  const micTrackRef = useRef<IMicrophoneAudioTrack | null>(null)
  const camTrackRef = useRef<ICameraVideoTrack | null>(null)
  const remoteAudioRef = useRef<IRemoteAudioTrack | null>(null)
  const remoteVideoTrackRef = useRef<IRemoteVideoTrack | null>(null)

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

  const cleanupTracks = useCallback(async () => {
    micTrackRef.current?.stop()
    micTrackRef.current?.close()
    micTrackRef.current = null

    camTrackRef.current?.stop()
    camTrackRef.current?.close()
    camTrackRef.current = null

    remoteAudioRef.current?.stop()
    remoteAudioRef.current = null
    remoteVideoTrackRef.current?.stop()
    remoteVideoTrackRef.current = null

    if (localVideoRef.current) localVideoRef.current.innerHTML = ''
    if (remoteVideoRef.current) remoteVideoRef.current.innerHTML = ''
  }, [])

  const leave = useCallback(async () => {
    const client = clientRef.current
    try {
      if (client) {
        await client.unpublish().catch(() => undefined)
        await client.leave()
      }
    } finally {
      await cleanupTracks()
      clientRef.current = null
      setConnected(false)
      setConnecting(false)
      setViewerCount(null)
      setReconnecting(false)
      setNeedsTapToPlay(false)
    }
  }, [cleanupTracks])

  const retry = useCallback(() => {
    setError(null)
    setWarning(null)
    setRetryKey((key) => key + 1)
  }, [])

  const resumePlayback = useCallback(() => {
    remoteAudioRef.current?.play()
    if (remoteVideoTrackRef.current && remoteVideoRef.current) {
      remoteVideoTrackRef.current.play(remoteVideoRef.current)
    }
    if (camTrackRef.current && localVideoRef.current) {
      camTrackRef.current.play(localVideoRef.current)
    }
    setNeedsTapToPlay(false)
  }, [])

  useEffect(() => {
    if (!enabled || !liveId) return

    let cancelled = false

    async function join() {
      setConnecting(true)
      setError(null)
      setWarning(null)
      setReconnecting(false)
      setNeedsTapToPlay(false)

      try {
        const tokenPayload = await fetchAgoraToken(liveId!, role)
        if (cancelled) return

        const client = AgoraRTC.createClient({
          mode: 'live',
          codec: 'vp8',
        })
        clientRef.current = client

        // Explicit broadcaster vs audience: audience cannot publish in live mode.
        await client.setClientRole(role === 'host' ? 'host' : 'audience')

        client.on('user-published', async (user, mediaType) => {
          await client.subscribe(user, mediaType)
          if (mediaType === 'video' && user.videoTrack) {
            remoteVideoTrackRef.current = user.videoTrack
            if (remoteVideoRef.current) {
              user.videoTrack.play(remoteVideoRef.current)
            }
          }
          if (mediaType === 'audio' && user.audioTrack) {
            remoteAudioRef.current = user.audioTrack
            user.audioTrack.play()
          }
        })

        client.on('user-unpublished', (_user, mediaType) => {
          if (mediaType === 'video') {
            remoteVideoTrackRef.current?.stop()
            remoteVideoTrackRef.current = null
            if (remoteVideoRef.current) remoteVideoRef.current.innerHTML = ''
          }
          if (mediaType === 'audio') {
            remoteAudioRef.current?.stop()
            remoteAudioRef.current = null
          }
        })

        const updateCount = () => {
          setViewerCount(client.remoteUsers.length + 1)
        }

        client.on('user-joined', updateCount)
        client.on('user-left', updateCount)

        client.on('connection-state-change', (cur: string, _prev: string, reason?: string) => {
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
          }

          const cameras = await AgoraRTC.getCameras().catch(() => [])
          setCanSwitchCamera(cameras.length > 1)
        }

        updateCount()
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
  }, [enabled, liveId, role, leave, retryKey])

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
    if (!track || role !== 'host') return
    const next = !micMuted
    await track.setEnabled(!next)
    setMicMuted(next)
  }, [micMuted, role])

  const toggleCamera = useCallback(async () => {
    const track = camTrackRef.current
    if (!track || role !== 'host') return
    const next = !cameraOff
    await track.setEnabled(!next)
    setCameraOff(next)
  }, [cameraOff, role])

  const switchCamera = useCallback(async () => {
    const track = camTrackRef.current
    if (!track || role !== 'host' || !canSwitchCamera) return
    const cameras = await AgoraRTC.getCameras()
    if (cameras.length < 2) return
    const currentId = track.getTrackLabel()
    const currentIndex = cameras.findIndex((camera) => camera.label === currentId)
    const nextCamera = cameras[(currentIndex + 1) % cameras.length]
    if (nextCamera?.deviceId) {
      await track.setDevice(nextCamera.deviceId)
    }
  }, [canSwitchCamera, role])

  return {
    localVideoRef,
    remoteVideoRef,
    connecting,
    connected,
    error,
    warning,
    micMuted,
    cameraOff,
    viewerCount,
    reconnecting,
    needsTapToPlay,
    toggleMic,
    toggleCamera,
    switchCamera,
    leave,
    retry,
    resumePlayback,
    canSwitchCamera,
  }
}
