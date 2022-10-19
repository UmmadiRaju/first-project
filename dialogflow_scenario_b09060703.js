require(Modules.AI);
const languageCode = "fr";
const agentId = 5451;
const profile = "projects/eyeflix-canada/conversationProfiles/9FyGgMLsRle4chG0U7TAiw";
const appName = "eyeflix-canada";
const region = null;
let agent,
  call,
  conversation,
  conversationParticipant,
  isConversationCreated = false,
  isCallCreated = false,
  isCallConnected = false,
  isParticipantCreated = false,
  hangup = false,
  transfer = false,
  outboundCall;
  VoxEngine.addEventListener(AppEvents.Started, function (ev) {
  agent = new CCAI.Agent(agentId, region);
  agent.addEventListener(CCAI.Events.Agent.Started, () => {
    conversation = new CCAI.Conversation({ agent, profile: { name: profile }, project: appName });
    conversation.addEventListener(CCAI.Events.Conversation.Created, () => {
      isConversationCreated = true;
      createParticipant();
    });
  });
});
VoxEngine.addEventListener(AppEvents.CallAlerting, function (ev) {
  isCallCreated = true;
  createParticipant();
  call = ev.call;
  call.answer();
  call.addEventListener(CallEvents.Connected, function () {
    isCallConnected = true;
  });
  call.addEventListener(CallEvents.Disconnected, function () {
    conversation.stop();
    VoxEngine.terminate();
  });
});
function endConversation() {
  conversation.stop();
  call.hangup();
    VoxEngine.terminate();
}
function createParticipant() {
  if (!isConversationCreated || !isCallCreated) return;
  conversationParticipant = conversation.addParticipant({
    call: call,
    options: { role: "END_USER" },
    dialogflowSettings: {
      enableMixedAudio: true,
      lang: languageCode,
      singleUtterance: true,
      replyAudioConfig: { audioEncoding: "OUTPUT_AUDIO_ENCODING_OGG_OPUS" },
    },
  });
  conversationParticipant.addEventListener(CCAI.Events.Participant.Created, () => {
    isParticipantCreated = true;
    setupMedia();
  });
  conversationParticipant.addEventListener(CCAI.Events.Participant.Response, (e) => {
    if (e.response.automatedAgentReply?.responseMessages) {
      e.response.automatedAgentReply.responseMessages.forEach((response) => {
        if (response.liveAgentHandoff) transfer = true;
        if (response.endInteraction && e.response.replyText) hangup = true;
        else if (response.endInteraction) endConversation();
      })
    }
  });
  conversationParticipant.addEventListener(CCAI.Events.Participant.PlaybackFinished, (e) => {
    if (hangup) {
      endConversation();
    }
    if (transfer) {
      transfer = false; 
      // Do an outbound call and connect it with the inbound one
      // outboundCall = VoxEngine.callPSTN("REPLACE_WITH_PHONE_NUMBER", "REPLACE_WITH_CALLER_ID");
      // VoxEngine.easyProcess(call, outboundCall);
    }
  })
}
function setupMedia() {
  if (!isParticipantCreated || !isCallConnected) return;
  conversationParticipant.analyzeContent({
    eventInput: { name: "WELCOME", languageCode: languageCode },
  });
  conversationParticipant.sendMediaTo(call);
}