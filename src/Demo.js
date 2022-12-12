import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import * as EVENTS from "./event";
import styles from "./demo.module.css";

const Demo = () => {
  const [socketId, setSocketId] = useState(null);
  const wsRef = useRef();
  const [disableJoin, setDisableJoin] = useState(false);
  const [isPeerConnected, setPeerConnected] = useState(false);
  const [searchParams] = useSearchParams();
  const remoteVideoRef = useRef();
  const deviceId = searchParams.get("deviceId").toUpperCase() ?? "ASDFG";
  let peerConnection;

  const sendSocketMessage = (type, data) => {
    const message = { type, data };
    wsRef.current.send(JSON.stringify(message));
  };

  const initializePeerConnection = async (deviceId) => {
    const config = {
      iceServers: [{ urls: ["stun:stun1.l.google.com:19302"] }],
    };
    peerConnection = new RTCPeerConnection(config);

    peerConnection.onicecandidate = ({ candidate }) => {
      if (!candidate) return;

      console.log("peerConnection::icecandidate", candidate);
      sendSocketMessage(EVENTS.ICECANDIDATE, { deviceId, candidate });
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log(
        "peerConnection::iceconnectionstatechange newState=",
        peerConnection.iceConnectionState
      );
      // If ICE state is disconnected stop
      if (peerConnection.iceConnectionState === "disconnected") {
        alert("Connection has been closed stopping...");
        wsRef.current.close();
      }
    };

    peerConnection.ontrack = ({ track }) => {
      console.log("peerConnection::track", track);
      const remoteMediaStream = new MediaStream();
      remoteMediaStream.addTrack(track);
      remoteVideoRef.current.srcObject = remoteMediaStream;
    };
  };

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8888");
    ws.onopen = (event) => {
      sendSocketMessage(EVENTS.INIT, {});
    };

    ws.onmessage = async (event) => {
      console.log(event);
      const payload = JSON.parse(event.data);

      switch (payload.type) {
        case EVENTS.INIT_SUCCESS:
          setSocketId(payload.data?.id);
          break;
        case EVENTS.JOIN_SUCCESS:
          setDisableJoin(true);
          if (payload.data.autoConnect) {
            setPeerConnected(true);
          }
          break;
        case EVENTS.JOIN_FAILED:
          console.error("Error connecting channel", payload.data?.msg);
          break;
        case EVENTS.LEFT_CHANNEL:
          setDisableJoin(false);
          break;
        case EVENTS.DEVICE_CONNECTED:
          setPeerConnected(true);
          break;
        case EVENTS.DEVICE_DISCONNECTED:
          setPeerConnected(false);
          break;
        case EVENTS.DEVICE_OFFER:
          await initializePeerConnection(deviceId);
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(payload.data?.offer)
          );

          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);

          sendSocketMessage(EVENTS.TAM_ANSWER, { deviceId, answer });
          break;
        case EVENTS.ICECANDIDATE:
          await peerConnection.addIceCandidate(payload.data?.candidate);
          break;
        default:
          console.warn("unknown event ", payload.type);
      }
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, []);

  return (
    <div align="center">
      <h1>{`TAM ${deviceId} - ${socketId}`}</h1>
      <br />

      <button
        onClick={() =>
          sendSocketMessage("JOIN_CHANNEL", { deviceId: deviceId })
        }
        disabled={disableJoin}
      >
        CONNECT TO DISPLAY
      </button>

      <button
        onClick={() =>
          sendSocketMessage("LEAVE_CHANNEL", { deviceId: deviceId })
        }
        disabled={!disableJoin}
      >
        DISCONNECT
      </button>

      <br />
      {disableJoin && isPeerConnected ? (
        <div className={styles.displayDiv} align="center">
          {/* <h3>Remote Video</h3> */}
          <div className={styles.tabOutline}>
            <div className={styles.tabInline}>
              <video
                id="remoteVideo"
                width="750"
                height="500"
                autoPlay
                ref={remoteVideoRef}
              ></video>
            </div>
          </div>
        </div>
      ) : (
        disableJoin &&
        !isPeerConnected && (
          <div className={styles.displayDiv}>
            <p
              style={{ color: "grey", fontSize: 25 }}
            >{`Waiting for display to connect...`}</p>
          </div>
        )
      )}
    </div>
  );
};

export default Demo;
