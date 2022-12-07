export const shareScreen = async () => {
  const mediaStream = await getLocalScreenCaptureStream();

  const screenTrack = mediaStream.getVideoTracks()[0];

  if (screenTrack) {
    console.log("replace camera track with screen track");
    replaceTrack(screenTrack);
  }
};

export const getLocalScreenCaptureStream = async () => {
  try {
    const constraints = { video: { cursor: "always" }, audio: false };
    const screenCaptureStream = await navigator.mediaDevices.getDisplayMedia(
      constraints
    );

    return screenCaptureStream;
  } catch (error) {
    console.error("failed to get local screen", error);
  }
};
