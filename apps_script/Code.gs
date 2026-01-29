/**
 * Google Apps Script (Web App)
 * - Deploy > New deployment > Web app
 * - Execute as: Me
 * - Who has access: Anyone within domain (recommended)
 *
 * Nota importante:
 * - El correo "From" será el del dueño del script, a menos que uses "Send mail as" (alias) o Delegación.
 * - Aun así, ponemos Reply-To = correo del KAM y CC al KAM.
 */
function doPost(e){
  try{
    var payload = JSON.parse(e.postData.contents || "{}");

    var to = payload.to || "";
    var cc = payload.cc || "";
    var subject = payload.subject || "Solicitud Nomad";
    var body = payload.body || "";

    if (!to || !subject || !body){
      return json_({ok:false, error:"missing_fields"});
    }

    GmailApp.sendEmail(to, subject, body, {
      cc: cc,
      replyTo: cc || ""
    });

    return json_({ok:true});
  }catch(err){
    return json_({ok:false, error:String(err)});
  }
}

function json_(obj){
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
