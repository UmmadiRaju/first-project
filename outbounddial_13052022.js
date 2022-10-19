require(Modules.CallList);
require(Modules.AI);
require(Modules.ASR);
const languageCode = "en";
const agentId = 4955;
const profile = "projects/mic-aaa-dev/conversationProfiles/Xz2TI8NqRC-k6lla5wx7vA";
const appName = "mic-aaa-dev";
const dialerServiceEndpoint = "http://voxidev.micnxt.com:35002/api/callinteractions";
const region = null;
let voicemail = false;
let is_pstn_transfer_enabled = true;
let outboundCallObj = null;
const axaDIDNumber = "+541143708247";

let dtmflist = {
    "DTMF_ONE": 1,
    "DTMF_TWO": 2,
    "DTMF_THREE": 3,
    "DTMF_FOUR": 4,
    "DTMF_FIVE": 5,
    "DTMF_SIX": 6,
    "DTMF_SEVEN": 7,
    "DTMF_EIGHT": 8,
    "DTMF_NINE": 9,
    "DTMF_ZERO": 0,
}
let sessionTranscript = {
    contactDataId: 0,
    callId: '',
    sessionId: '',
    dialStatus: false,
    transferStatus: false,
    contactNumber: '',
    callStartDateTime: null,
    callConnectDateTime: null,
    customerTranscriptTimeBeforeDFStarts:null,
    callTransferDateTime: null,
    callEndDateTime: null,
    transcript: '',
    eventData:'',
    callRecordUrl: '',
    callLastStatus: '',
    createDateTime: null
};

let agentTranscript = []
let eventData = []
let agent,
    call,
    dialinfo,
    conversation,
    conversationParticipant,
    isConversationCreated = false,
    isCallCreated = false,
    isCallConnected = false,
    isParticipantCreated = false,
    hangup = false,
    transfer = false,
    apiCallDoneTransfer = false,
    outboundCall,
    sessionID,
    asr_speech_result = "";


const asr = VoxEngine.createASR({ profile: ASRProfileList.Google.es_US });
asr.addEventListener(ASREvents.Result, e => {
  // Recognition results arrive here
 asr_speech_result += (e.text + " ");

  Logger.write("ASR Speech result : " + asr_speech_result); 
  asr.stop(); 
  // If CaptureStarted wo not be triggered in 5 seconds then stop recognition
  //ts = setTimeout(() => asr.stop(), 5000);
});
asr.addEventListener(ASREvents.SpeechCaptured, () => {
  // After speech has been captured - do not stop sending media to ASR
  //call.stopMediaTo(asr);
  Logger.write("ASREvents.SpeechCaptured");
});
asr.addEventListener(ASREvents.CaptureStarted, () => {
  // Clear timeout if CaptureStarted has been triggered
  //clearTimeout(ts);
  Logger.write("ASREvents.CaptureStarted");
});

VoxEngine.addEventListener(AppEvents.Started, function (ev) {

    let data = VoxEngine.customData();
    dialinfo = JSON.parse(data);
    first_name = dialinfo.firstName;
    last_name = dialinfo.lastName;
    phone_number = dialinfo.contactNumber;
    capability = dialinfo.capability;
    call_DNI = dialinfo.DNI;
    sessionID = ev.sessionId;
    sessionTranscript.contactDataId = parseInt(dialinfo.contactDataId);
    sessionTranscript.contactNumber = dialinfo.contactNumber;
    sessionTranscript.sessionId = sessionID.toString();

    call = VoxEngine.callPSTN(phone_number, "61871002308");
    call.sendMediaTo(asr);
                
    call.addEventListener(CallEvents.AudioStarted, onAudioStarted);
    call.addEventListener(CallEvents.Connected, onCallConnected)
    call.addEventListener(CallEvents.Failed, handleCallFailed);
    call.addEventListener(CallEvents.RecordStarted, handleRecordStarted);
    call.addEventListener(CallEvents.Disconnected, handleCallDisconnected);
    call.addEventListener(CallEvents.OnHold, onHold);

    sessionTranscript.callStartDateTime = new Date().toISOString();
    sessionTranscript.callLastStatus = "CALL_RINGING"
    sessionTranscript.callId = call.id();
    
    
    Logger.write(`Calling ${first_name} ${last_name} on ${phone_number}`);
    Logger.write(`Call connected for sessionId ${sessionID} and callid: ${call.id()}`)
    agent = new CCAI.Agent(agentId, region);

    agent.addEventListener(CCAI.Events.Agent.Started, () => {        
        Logger.write(sessionID + " : CCAI.Events.Agent.Started");
        conversation = new CCAI.Conversation({ agent, profile: { name: profile }, project: appName });
        Logger.write(sessionID + " : Conversation object created");
        conversation.addEventListener(CCAI.Events.Conversation.Created, () => {
            Logger.write(sessionID + " : CCAI.Events.Conversation.Created");  
           
            // call recording with transcribe
            
        });
    });

});

function onAudioStarted() {
    Logger.write("Received onAudioStarted event for callID : " + call.id() + ", sessionID " + sessionID);
}

function onCallConnected() {

    AI.detectVoicemail(call).then(e => {
      Logger.write('Voicemail detected in  onCallConnected event meaning during call.')
      voicemail = true;
      sessionTranscript.callLastStatus = "VOICEMAIL_DETECTED"
      // Hangup call after mp3 message was played to the inbox
      call.hangup();      
      return;
    }).catch(e => {
      // No voicemail found
         Logger.write('Voicemail tone wasn\'t detected onCallConnected event, while during call')
    })
    Logger.write(`Call connected for sessionId ${sessionID} and callid: ${call.id()}`)
    call.record({hd_audio: true,transcribe: true,transcriptionThreshold: 0, language: languageCode})          
    sessionTranscript.dialStatus = true;            
    sessionTranscript.callConnectDateTime = new Date().toISOString();
    sessionTranscript.callLastStatus = "CALL_CONNECTED"
    createParticipant();
    conversationParticipant.sendMediaTo(call); //Venky 23042022
    setupMedia();

    var currentDateTime = new Date();
    currentDateTime.setSeconds(currentDateTime.getSeconds() + 3)
    sessionTranscript.customerTranscriptTimeBeforeDFStarts = currentDateTime.toISOString();

    //conversationParticipant.sendMediaTo(call); -- Venky 23042022
}

function onCallDisconnected() {
    Logger.write('Received onCallDisconnected event for callID : ' + call.id() + ", sessionID " + sessionID);
    if(conversation){
        conversationParticipant.stopMediaTo(call);
    conversation.stop();
    }
    

    Logger.write("Successfully call disconnected");
}

function onCallFailed() {
    Logger.write('Received onCallFailed event for callID : ' + call.id() + ", sessionID " + sessionID);
}

function onHold() {
    sessionTranscript.callLastStatus = "ON_HOLD"
    Logger.write('Received onHold event for callID : ' + call.id() + ", sessionID " + sessionID);
}

function createParticipant() {
    Logger.write(call.id() + " : createParticipant called");
    conversationParticipant = conversation.addParticipant({
        call: call,
        options: { role: "END_USER" },
        dialogflowSettings: {
            audioEncoding: "AUDIO_ENCODING_LINEAR16",
            profanityFilter: true,
            enableWordTimeOffsets: true,
            enableWordConfidence: true,
            enableAutomaticPunctuation: true,
            enableSpokenPunctuation: true,
            enableSpokenEmojis: true,
            sampleRateHertz: 8000,
            enableMixedAudio: true,
            lang: languageCode,
            singleUtterance: true,
            model: DialogflowModel.COMMAND_AND_SEARCH, 
            // model: DialogflowModel.PHONE_CALL, 
             //modelVariant: DialogflowModelVariant.USE_ENHANCED,
            phraseHints:['yes','no'],
            replyAudioConfig: {
                audioEncoding: "OUTPUT_AUDIO_ENCODING_OGG_OPUS",
                synthesizeSpeechConfig: {
                    effectsProfileId: [
                    "telephony-class-application"
                    ],
                    pitch: 0,
                    speakingRate: 0.9,
                    voice: { name: "en-US-Wavenet-H" }  
                },
            }
        },

    })

    Logger.write(call.id() + " : conversationParticipant object  created");

    conversationParticipant.addEventListener(CCAI.Events.Participant.Created, () => {
        Logger.write(call.id() + " : CCAI.Events.Participant.Created");
    });
    conversationParticipant.addEventListener(CCAI.Events.Participant.Response, (e) => {
        Logger.write(call.id() + " : CCAI.Events.Participant.Response");
        if (e.response.automatedAgentReply?.responseMessages) {
            Logger.write(`Agent transcript: ${JSON.stringify({type: "customer", message: e.response.replyText, timestamp: new Date().toISOString()})}`)
            agentTranscript.push({type: "agent", message: e.response.replyText, timestamp: new Date().toISOString()})
            e.response.automatedAgentReply.responseMessages.forEach((response) => {
                if (response.liveAgentHandoff) transfer = true;
                if (response.endInteraction && e.response.replyText) hangup = true;
                else if (response.endInteraction) endConversation();
            })
        }
        if (e.response.recognitionResult?.isFinal) {
            if(e.response.recognitionResult.messageType == "DTMF_DIGITS"){
                var dtmfdigit='';
               e.response.recognitionResult.dtmfDigits.dtmfEvents.forEach((el)=>{
                    // Logger.write('dtmf : '+el+' : '+dtmflist[el])
                     dtmfdigit=dtmfdigit+dtmflist[el];
                     Logger.write('dtmf : '+el+' : '+dtmfdigit)
                })
                Logger.write(`Customer transcript: ${JSON.stringify({type: "customer", message: e.response.recognitionResult.transcript, timestamp: new Date().toISOString()})}`)
          // agentTranscript.push({type: "customer", message: dtmflist[e.response.recognitionResult.dtmfDigits.dtmfEvents[0]], timestamp: new Date().toISOString()})
             agentTranscript.push({type: "customer", message: dtmfdigit, timestamp: new Date().toISOString()})
          
            } else {
                Logger.write(`Customer transcript: ${JSON.stringify({type: "customer", message: e.response.recognitionResult.transcript, timestamp: new Date().toISOString()})}`)
            agentTranscript.push({type: "customer", message: e.response.recognitionResult.transcript, timestamp: new Date().toISOString()})
            }
        }
    });
    conversationParticipant.addEventListener(CCAI.Events.Participant.Response, (e) => {
        Logger.write(call.id() + " : CCAI.Events.Participant.Response");
        if (e.response.automatedAgentReply?.responseMessages) {
            e.response.automatedAgentReply.responseMessages.forEach((response) => {
                if (response.liveAgentHandoff) transfer = true;
                if (response.endInteraction && e.response.replyText) hangup = true;
                else if (response.endInteraction) endConversation();
            })
        }
    });
    conversationParticipant.addEventListener(CCAI.Events.Participant.PlaybackFinished, (e) => {
        Logger.write(call.id() + " : CCAI.Events.Participant.PlaybackFinished");

        if (hangup) {
            endConversation();
        }
        if (transfer) {
            transfer = false;
            apiCallDoneTransfer = true;
            Logger.write(`Transfer Inside`)
            // Do an outbound call and connect it with the inbound one
            // sipuser1@mic-argentina-dev-mic-argentina-dev.prasadk.n2.voximplant.com
            Logger.write(`Calling SIP URL`);

            if (!is_pstn_transfer_enabled)            
                outboundCallObj = transferCallToSip3CX();
            else 
                outboundCallObj = transferCallToDID();

            outboundCallObj.addEventListener(CallEvents.Connected, () => {
                sessionTranscript.transferStatus = true;
                sessionTranscript.callTransferDateTime = new Date().toISOString();
                sessionTranscript.callLastStatus = "TRANSFER_SUCCESS"
                apiCall()
                VoxEngine.easyProcess(call, outboundCallObj, () => {
                    conversationParticipant.analyzeContent({
                        eventInput: { name: "TRANSFER_SUCCESS", languageCode: languageCode },
                    });
                    endConversation();
                });
            });
            outboundCallObj.addEventListener(CallEvents.Failed, (e) => {
                sessionTranscript.callTransferDateTime = new Date().toISOString();
                sessionTranscript.callLastStatus = "TRANSFER_FAIL"
                apiCall()
                Logger.write(`Transfer failed: ${JSON.stringify(e)}`)
                conversationParticipant.analyzeContent({
                    eventInput: { name: "TRANSFER_FAIL", languageCode: languageCode },
                });
            });
            outboundCallObj.addEventListener(CallEvents.Disconnected, handleCallDisconnected);
        }
    })
}

function transferCallToSip3CX()
{
    try
    {
        sipuri = 'sip:10008@venkatesh-allamkam.my3cx.sg:5060;transport=tcp';

        Logger.write("transferCallToSip3CX : sipuri : " + sipuri + ", callerid : +918123597257");
        
        outboundCall = VoxEngine.callSIP(sipuri, {
            callerid: "+918123597257",
            displayName: "Hedy Lamarr",
            //password: "P@ssw0rd",
            //authUser: "10001",
            outProxy: "venkatesh-allamkam.my3cx.sg",
            regId: "7602"
        });
        return outboundCall;      
    }
    catch (ex)
    {
        Logger.write(`exception in transferCallToSip3CX : ` + ex);
    }
}

function transferCallToDID()
{
    try
    {
        Logger.write("transferCallToDID : axaDIDNumber : " + axaDIDNumber + ", customerPhoneNumber : +541139865247"); 
        outboundCall = VoxEngine.callPSTN(axaDIDNumber, "+541139865247");
        return outboundCall;
    }
    catch (ex)
    {
        Logger.write(`exception in transferCallToDID : ` + ex);
    }
}

function setupMedia() {
    Logger.write(call.id() + " : setupMedia called");
    conversationParticipant.analyzeContent({
        eventInput: { name: "OUTBOUNDDIAL", languageCode: languageCode, parameters: dialinfo },
        // textInput: {enable_splitting_text: true, languageCode: languageCode, text: "outbound"} ,
    });
    
    Logger.write(call.id() + " : conversationParticipant.sendMediaTo called");
}

function endConversation() {
    conversation.stop();
    if(!apiCallDoneTransfer){
        apiCall()
    }
    call.hangup();
    VoxEngine.terminate();
}


function handleCallDisconnected(e) {
    if(conversation){
        conversation.stop();
    }
    
    if(!apiCallDoneTransfer){
        apiCall()
    }
    VoxEngine.terminate();
    

}
function handleRecordStarted(e) {
    Logger.write(`Recording started for sessionId ${sessionID} url: ${e.url}`)
    sessionTranscript.callRecordUrl = e.url;
}
function handleCallFailed(e) {
    if(conversation){
        conversation.stop();
    }
    if(!apiCallDoneTransfer){
        apiCall()
    }
    VoxEngine.terminate();
    
}

function apiCall(){

    sessionTranscript.callEndDateTime = new Date().toISOString();
    if(!sessionTranscript.dialStatus) sessionTranscript.callLastStatus = voicemail?"VOICEMAIL_DETECTED":"CALL_DISCONNECTED"

    if (asr_speech_result != "")
        agentTranscript.unshift({type: "customer", message: asr_speech_result, timestamp: sessionTranscript.customerTranscriptTimeBeforeDFStarts});

    sessionTranscript.transcript = JSON.stringify(agentTranscript)
    Logger.write(`session details : ${JSON.stringify(sessionTranscript)}`)

    Net.httpRequest(dialerServiceEndpoint, function(e) {
      if(e.code == 200) { 
        Logger.write("Connected successfully");
        Logger.write("code:  " + e.code);
        Logger.write("data:  " + e.data);
        Logger.write("error:  " + e.error);
        Logger.write("headers:  " + JSON.stringify(e.headers));
        Logger.write("raw_headers:  " + e.raw_headers);
        Logger.write("text:  " + e.text);
      } else { 
        Logger.write("Unable to connect");
      }
    },  { rawOutput: true, method: 'POST',postData: JSON.stringify(sessionTranscript), headers:'Content-Type: application/json' } );
  
}
 //modelVariant: DialogflowModelVariant.USE_ENHANCED,
            //model: "latest_short",
            //model: "experimental_rnnt_short",
