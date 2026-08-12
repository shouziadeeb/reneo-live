import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import AgoraRTC, {
  type IAgoraRTCClient,
  type ICameraVideoTrack,
  type IMicrophoneAudioTrack,
  type IRemoteAudioTrack,
  type IRemoteVideoTrack,
} from 'agora-rtc-sdk-ng'
import { fetchAgoraToken } from '../lib/agora'

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
  micMuted: boolean
  cameraOff: boolean
  viewerCount: number | null
  toggleMic: () => Promise<void>
  toggleCamera: () => Promise<void>
  switchCamera: () => Promise<void>
  leave: () => Promise<void>
  canSwitchCamera: boolean
}

function friendlyAgoraError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const lower = message.toLowerCase()

  if (lower.includes('permission') || lower.includes('notallowed')) {
    return 'Camera or microphone permission was denied. Allow access in your browser settings and try again.'
  }
  if (lower.includes('device not found') || lower.includes('notfound')) {
    return 'No camera or microphone was found on this device.'
  }
  if (lower.includes('token')) {
    return 'Could not authorize the live stream. Please refresh and try again.'
  }
  if (lower.includes('network') || lower.includes('timeout')) {
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
  const [micMuted, setMicMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [viewerCount, setViewerCount] = useState<number | null>(null)
  const [canSwitchCamera, setCanSwitchCamera] = useState(false)

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
    }
  }, [cleanupTracks])

  useEffect(() => {
    if (!enabled || !liveId) return

    let cancelled = false

    async function join() {
      setConnecting(true)
      setError(null)

      try {
        const tokenPayload = await fetchAgoraToken(liveId!, role)
        if (cancelled) return

        const client = AgoraRTC.createClient({
          mode: 'live',
          codec: 'vp8',
        })
        clientRef.current = client

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

        client.on('user-unpublished', (user, mediaType) => {
          if (mediaType === 'video') {
            remoteVideoTrackRef.current?.stop()
            remoteVideoTrackRef.current = null
            if (remoteVideoRef.current) remoteVideoRef.current.innerHTML = ''
          }
          if (mediaType === 'audio') {
            remoteAudioRef.current?.stop()
            remoteAudioRef.current = null
          }
          void user
        })

        const updateCount = () => {
          // Host + remote users currently in the RTC channel (reliable via Agora client state)
          setViewerCount(client.remoteUsers.length + 1)
        }

        client.on('user-joined', updateCount)
        client.on('user-left', updateCount)

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
          const [micTrack, camTrack] = await AgoraRTC.createMicrophoneAndCameraTracks()
          if (cancelled) {
            micTrack.close()
            camTrack.close()
            await client.leave()
            return
          }

          micTrackRef.current = micTrack
          camTrackRef.current = camTrack

          if (localVideoRef.current) {
            camTrack.play(localVideoRef.current)
          }

          await client.publish([micTrack, camTrack])

          const cameras = await AgoraRTC.getCameras()
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
      void leave()
    }
  }, [enabled, liveId, role, leave])

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
    micMuted,
    cameraOff,
    viewerCount,
    toggleMic,
    toggleCamera,
    switchCamera,
    leave,
    canSwitchCamera,
  }
}
