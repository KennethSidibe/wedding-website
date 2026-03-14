import { emailImgCid } from "./string.constants.js";

const emailBody = `
<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">

<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Merci de t'être enregistré</title>
</head>

<body style="margin:0; padding:0; background-color:#f4f4f4; width:100%;">
  <!-- Preheader text -->
  <span style="display:none; font-size:1px; color:#f4f4f4; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
      Merci de t'être enregistré.
    </span>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
    style="border-collapse:collapse; background-color:#f4f4f4; margin:0; padding:0; width:100%;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
          style="border-collapse:collapse; max-width:600px; width:100%; background-color:#ffffff;">
          <tr>
            <td style="padding:40px 32px 24px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                style="border-collapse:collapse; width:100%;">
                <tr>
                  <td align="center" style="padding:0 0 24px 0;">
                    <h1
                      style="font-family:Garamond, Gerogia, serif; margin:0; font-size:28px; line-height:36px; font-weight:bold; color:#222222;" >
                      Merci de t'être enregistré
                    </h1>
                  </td>
                </tr>

                <tr>
                  <td align="left" style="padding:0 0 24px 0;">
                    <p
                      style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:24px; color:#444444;">
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut
                      labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
                      nisi ut aliquip ex ea commodo consequat.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td align="center" style="padding:0;">
                    <img
                        src="cid:${emailImgCid}"
                        alt="Image illustrative"
                        width="300"
                        height="200"
                        style="display:block; border:0; outline:none; text-decoration:none; width:100%; max-width:300px; height:auto;"
                      />
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
          style="border-collapse:collapse; max-width:600px; width:100%;">
          <tr>
            <td align="center" style="padding:16px 32px 0 32px;">
              <p
                style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:18px; color:#888888;">
                © 2026 Légende + Sheridan 
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>

</html>`;

export default emailBody;