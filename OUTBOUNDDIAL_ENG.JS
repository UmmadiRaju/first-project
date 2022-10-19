require(Modules.CallList);
require(Modules.AI);
require(Modules.ASR);
const languageCode = "en";
const agentId = 5653;
const profile = "projects/doctafix-preprod/conversationProfiles/3fEXX3NbTLuqn4eeNkiPRA";
const appName = "doctafix-preprod";
const dialerServiceEndpoint = "https://eyeflix.micnxt.com/api/callinteractions";
const region = null;
let voicemail = false;
let is_pstn_transfer_enabled = true;
let outboundCallObj = null;
const axaDIDNumber = "+541143708247";
const dialogflowTTSVoice = "en-US-Wavenet-H";
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
    sessionID;
is_transfer_initiated = false;

VoxEngine.addEventListener(AppEvents.Started, function (ev) {

    let data = VoxEngine.customData();
    dialinfo = JSON.parse(data);
    first_name = dialinfo.firstName;
    last_name = dialinfo.lastName;
    phone_number = dialinfo.contactNumber;
    capability = dialinfo.capability;
    call_DNI = dialinfo.DNI;

    //lokesh changes start
    let translateJson = dialinfo.firstName.split("'").join("\"");
    //Logger.write( " : testJson :"+testJson );
    let dailogInfo = JSON.parse(translateJson);
    dialinfo.firstName = dailogInfo.firstName;
    dialinfo.lastName = dailogInfo.lastName;
    dialinfo.contactNumber = dailogInfo.contactNumber;
    dialinfo.month = dailogInfo.month;
    dialinfo.year = dailogInfo.year;
    dialinfo.contactNumber=dialinfo.contactNumber;
     dialinfo.appointmentDate = dailogInfo.appointmentDate;
     dialinfo.appointmentTime = dailogInfo.appointmentTime;
     dialinfo.hcp = dailogInfo.hcp;
     dialinfo.clinic = dailogInfo.clinic;
     dialinfo.type = dailogInfo.type;
     dialinfo.appointmentId = dailogInfo.appointmentId;
     dialinfo.capability = dailogInfo.capability;
    dialinfo.language = dailogInfo.language;
    dialinfo.newDate = dailogInfo.newDate;
    dialinfo.newTime = dailogInfo.newTime;
    dialinfo.previousDate = dailogInfo.previousDate;
    dialinfo.previousTime = dailogInfo.previousTime;

    sessionID = ev.sessionId;
    sessionTranscript.contactDataId = parseInt(dialinfo.contactDataId);
    sessionTranscript.contactNumber = dialinfo.contactNumber;
    sessionTranscript.sessionId = sessionID.toString();

    call = VoxEngine.callPSTN(phone_number, "+18882693710");
                
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
    //call.record({hd_audio: true,transcribe: true,transcriptionThreshold: 0})          
    sessionTranscript.dialStatus = true;            
    sessionTranscript.callConnectDateTime = new Date().toISOString();
    sessionTranscript.callLastStatus = "CALL_CONNECTED"
    createParticipant();
        
    conversationParticipant.sendMediaTo(call); //Venky 23042022
    setupMedia();
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
            //profanityFilter: true,
            enableWordTimeOffsets: true,
            enableWordConfidence: true,
            enableAutomaticPunctuation: true,
            enableSpokenPunctuation: true,
            enableSpokenEmojis: true,
            sampleRateHertz: 16000,
            enableMixedAudio: true,
            lang: languageCode,
            singleUtterance: true,
            model: DialogflowModel.PHONE_CALL,
            //model: DialogflowModel.COMMAND_AND_SEARCH,
            modelVariant: DialogflowModelVariant.USE_ENHANCED,
            //model: "latest_short",
            //model: "experimental_rnnt_short",
            phraseHints:['yes','no'],
            replyAudioConfig: {
                //audioEncoding: "OUTPUT_AUDIO_ENCODING_OGG_OPUS",
                audioEncoding: "OUTPUT_AUDIO_ENCODING_OGG_OPUS",
                synthesizeSpeechConfig: {
                    effectsProfileId: [
                    "telephony-class-application"
                    ],
                    pitch: 0,
                    speakingRate: 1.0,
                    voice: { name: "en-US-Wavenet-H" }  
                },
            }
        },

    });

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
                if (response.liveAgentHandoff) 
                {
                    Logger.write("setting transfer flag true in CCAI.Events.Participant.Response at line number 240 ");
                    transfer = true;
                }
                if (response.endInteraction && e.response.replyText) 
                {
                    Logger.write("setting hangup flag true in CCAI.Events.Participant.Response at line number 245 ");
                    hangup = true;
                }
                else if (response.endInteraction) 
                {
                    Logger.write("endConversation is calling from line number 242");
                    endConversation();
                }
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
        call.record({hd_audio: true,transcribe: true,transcriptionThreshold: 0}) 
    });
    conversationParticipant.addEventListener(CCAI.Events.Participant.Response, (e) => {
        //below source is commented by venky on 8th May 2022
        // Logger.write(call.id() + " : CCAI.Events.Participant.Response");
        // if (e.response.automatedAgentReply?.responseMessages) {
        //     e.response.automatedAgentReply.responseMessages.forEach((response) => {
        //         if (response.liveAgentHandoff) 
        //         {
        //             Logger.write("setting transfer flag true in CCAI.Events.Participant.Response at line number 275");
        //             transfer = true;
        //         }
        //         if (response.endInteraction && e.response.replyText) 
        //         {
        //             Logger.write("setting hangup flag true in CCAI.Events.Participant.Response at line number 284 ");
        //             hangup = true;                    
        //         }
        //         else if (response.endInteraction) 
        //         {
        //             Logger.write("endConversation is calling from line number 273");
        //             endConversation();
        //         }
        //     })
        // }
    });
    conversationParticipant.addEventListener(CCAI.Events.Participant.PlaybackFinished, (e) => { 
        
        Logger.write(call.id() + " : CCAI.Events.Participant.PlaybackFinished");

        if (hangup && !transfer) {
            Logger.write("endConversation is calling from line number 283");
            endConversation();
        }
        if (transfer && !is_transfer_initiated) {
            //transfer = false; commented by venky on 8th May 2022
            apiCallDoneTransfer = true;
            is_transfer_initiated = true; //added by venky on 8th May 2022 because i see hangup & transfer flags are setting paralally which is causing transfer       //initation twice.
            Logger.write(`Transfer Inside`)
            // Do an outbound call and connect it with the inbound one
            // sipuser1@mic-argentina-dev-mic-argentina-dev.prasadk.n2.voximplant.com
            Logger.write(`Calling SIP URL`);

            if (!is_pstn_transfer_enabled)            
                outboundCallObj = transferCallToSip3CX();
            else 
                outboundCallObj = transferCallToDID();

            outboundCallObj.addEventListener(CallEvents.Connected, () => 
            {
                Logger.write("outboundCallObj : Transfer outbound call connected ");
                sessionTranscript.transferStatus = true;
                sessionTranscript.callTransferDateTime = new Date().toISOString();
                sessionTranscript.callLastStatus = "TRANSFER_SUCCESS"
                transfer = false; //added by venky on 8th May 2022
                apiCall()
                endDFConversation();
                VoxEngine.easyProcess(call, outboundCallObj, () => 
                {
                    Logger.write("outboundCallObj : transfer is completed successfully ");
                    conversationParticipant.analyzeContent({
                        eventInput: { name: "TRANSFER_SUCCESS", languageCode: languageCode },
                    });
                    Logger.write("outboundCallObj : transfer is completed successfully, hence calling endConversation ");
                    Logger.write("endConversation is calling from line number 313");
                    endDFConversation();
                });
            });
            outboundCallObj.addEventListener(CallEvents.Failed, (e) => 
            {
                Logger.write("outboundCallObj : Transfer outbound call failed ");
                sessionTranscript.callTransferDateTime = new Date().toISOString();
                sessionTranscript.callLastStatus = "TRANSFER_FAIL"
                transfer = false; //added by venky on 8th May 2022
                apiCall()                
                endDFConversation();
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
//-- venky added this method on 7th May 2022 to fix transfer issue
function endDFConversation()
{
    conversation.stop();
    if(!apiCallDoneTransfer){
        apiCall()
    }
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

