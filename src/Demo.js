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
  const deviceId = searchParams.get("deviceId")?.toUpperCase() ?? "ASDFG";
  let peerConnection;

  const waitForSocketOpen = async (ws) => {
    while (ws.readyState !== ws.OPEN) {
      return;
    }
  };

  const sendSocketMessage = (type, data) => {
    const message = { type, data };
    try {
      wsRef.current.send(JSON.stringify(message));
    } catch (_) {
      setDisableJoin(true);
    }
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
    //const ws = new WebSocket("ws://webrtc-signal-server.herokuapp.com/");
    ws.onopen = async (event) => {
      await waitForSocketOpen(ws);
      sendSocketMessage(EVENTS.INIT, {});
    };

    ws.onmessage = async (event) => {
      console.log(event);
      const payload = JSON.parse(event.data);

      switch (payload.type) {
        case EVENTS.INIT_SUCCESS:
          setSocketId(payload.data?.id);
          break;
        case EVENTS.PONG:
          console.log("Pong Receieved");
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
      console.log("calling unmount");
      ws.close();
    };
  }, []);

  setInterval(() => {
    sendSocketMessage(EVENTS.PING, {});
  }, 55000);

  console.log("DisableConnect", disableJoin);

  return (
    <div style={{ padding: "0 50px" }}>
      <div style={{ display: "flex", justifyContent: "space-around" }}>
        <h1>TAM REMOTE ASSIST</h1>
        <p style={{ fontSize: "24px" }}>Device Id : {deviceId}</p>
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        {disableJoin && isPeerConnected && (
          <div className={styles.displayDiv} align="center">
            <div className={styles.tabOutline}>
              <div className={styles.tabInline}>
                <video
                  id="remoteVideo"
                  width="900"
                  height="400"
                  autoPlay
                  ref={remoteVideoRef}
                ></video>
              </div>
            </div>
          </div>
        )}
        {disableJoin && !isPeerConnected && (
          <div className={styles.displayDiv}>
            <p
              className={styles.placeholderText}
            >{`Waiting for display to connect...`}</p>
          </div>
        )}
        {!disableJoin && (
          <div className={styles.displayDiv}>
            <p className={styles.placeholderText}>{`Connect to Display`}</p>
          </div>
        )}
      </div>
      <div className={styles.flexWithPadding}>
        <div className={styles.flexWithGap}>
          <button
            className={styles.connectBtn}
            onClick={() =>
              sendSocketMessage("BUTTON_EVENTS", { eventType: EVENTS.BACK })
            }
            disabled={false}
          >
            {EVENTS.BACK}
          </button>
          <button
            className={styles.connectBtn}
            onClick={() =>
              sendSocketMessage("BUTTON_EVENTS", { eventType: EVENTS.HOME })
            }
            disabled={false}
          >
            {EVENTS.HOME}
          </button>
          <button
            className={styles.connectBtn}
            onClick={() =>
              sendSocketMessage("BUTTON_EVENTS", { eventType: EVENTS.RECENTS })
            }
            disabled={false}
          >
            {EVENTS.RECENTS}
          </button>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-around",
            flex: "1",
            gap: "10px",
          }}
        >
          <button
            className={styles.connectBtn}
            onClick={() =>
              sendSocketMessage("JOIN_CHANNEL", { deviceId: deviceId })
            }
            disabled={disableJoin}
          >
            CONNECT TO DISPLAY
          </button>

          <button
            className={styles.disconnectBtn}
            onClick={() =>
              sendSocketMessage("LEAVE_CHANNEL", { deviceId: deviceId })
            }
            disabled={!disableJoin}
          >
            DISCONNECT
          </button>
        </div>
      </div>
    </div>

    // <div style={{display:"flex"}}>
    //   <div style={{flex:"1",display:"flex",justifyContent:"center",alignItems:"center",flexDirection:"column"}}>
    //     <div>
    //       <h1>TAM</h1>
    //     </div>
    //     <div>
    //       <h3 style={{marginLeft:"50px"}}>Device Id : {deviceId}</h3>
    //       <h3 style={{marginLeft:"50px"}}>Socket Id : {socketId}</h3>
    //     </div>
    //   </div>
    //   <div style={{flex:"2"}}>
    //   {disableJoin && isPeerConnected ? (
    //     <div className={styles.displayDiv} align="center">
    //       {/* <h3>Remote Video</h3> */}
    //       <div className={styles.tabOutline}>
    //         <div className={styles.tabInline}>
    //           <video
    //             id="remoteVideo"
    //             width="750"
    //             height="500"
    //             autoPlay
    //             ref={remoteVideoRef}
    //           ></video>
    //         </div>
    //       </div>
    //     </div>
    //   ) : (
    //     disableJoin &&
    //     !isPeerConnected && (
    //       <div className={styles.displayDiv}>
    //         <p
    //           style={{ color: "grey", fontSize: 25 }}
    //         >{`Waiting for display to connect...`}</p>
    //       </div>
    //     )
    //   )}
    //   </div>
    //   {/* <button
    //     onClick={() =>
    //       sendSocketMessage("JOIN_CHANNEL", { deviceId: deviceId })
    //     }
    //     disabled={disableJoin}
    //   >
    //     CONNECT TO DISPLAY
    //   </button> */}

    //   {/* <button
    //     onClick={() =>
    //       sendSocketMessage("LEAVE_CHANNEL", { deviceId: deviceId })
    //     }
    //     disabled={!disableJoin}
    //   >
    //     DISCONNECT
    //   </button> */}
    // </div>
  );
};

export default Demo;
