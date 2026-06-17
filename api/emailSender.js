require('dotenv').config();
const AWS = require('aws-sdk');

const ses = new AWS.SES({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'ap-south-1',
});

// Utility function to parse email addresses from environment variables
function parseDevEmails(devEmailString) {
  if (!devEmailString) return [];

  let emails = [];

  if (devEmailString.includes(',')) {
    emails = devEmailString.split(',').map(email => email.trim());
  } else if (devEmailString.startsWith('[') && devEmailString.endsWith(']')) {
    try {
      emails = JSON.parse(devEmailString);
    } catch (err) {
      emails = [devEmailString];
    }
  } else {
    emails = [devEmailString];
  }

  return emails.filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

// Get development email addresses as array
function getDevEmails() {
  let devEmailString = process.env.DEV_TEST_EMAIL || '';

  if (devEmailString.startsWith('"') && devEmailString.endsWith('"')) {
    devEmailString = devEmailString.slice(1, -1);
  }
  if (devEmailString.startsWith("'") && devEmailString.endsWith("'")) {
    devEmailString = devEmailString.slice(1, -1);
  }

  return parseDevEmails(devEmailString);
}

/**
 * Send an email notification via AWS SES
 * @param {string|string[]} to - recipient email or array of emails
 * @param {string} subject - email subject
 * @param {object} context - context object for template
 * @param {string} type - task, project, comment
 */
async function sendNotificationEmail(to, subject, context, type = 'notification') {
  if (!to || (Array.isArray(to) && to.length === 0)) return;

  const getInitials = (name) => name ? name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : 'U';
  
  // Format avatar block
  const avatarInitials = getInitials(context.author);
  const avatarHtml = `<div style="display:inline-block; width:36px; height:36px; border-radius:50%; background-color:#1f2937; color:#fff; text-align:center; line-height:36px; font-weight:bold; font-size:14px; margin-right:12px; vertical-align:middle;">${avatarInitials}</div>`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f4f5f7; padding: 40px 20px;">
      
      <div style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        
        <!-- Top header with logo -->
        <div style="border-top: 4px solid #000000; text-align: center; padding: 20px 0; border-bottom: 1px solid #e5e7eb;">
          <h1 style="margin:0; padding-left:40px; font-size:20px; font-weight:700; color:#1a1d1f; display:flex;">
             Trexo CRM
          </h1>
          ${context.taskId ? `
            <div style="margin:0; padding-left:40px; font-size:13px; font-weight:600; color:#6b7280; display:flex; margin-top:2px;">
              (${context.taskId})
            </div>
          ` : ''}
        </div>
        
        <!-- Main Content -->
        <div style="padding: 32px 40px;">
          
          <div style="display: flex; align-items: flex-start; margin-bottom: 16px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td width="48" valign="top">
                  ${avatarHtml}
                </td>
                <td valign="top" style="padding-top: 6px;">
                  <span style="font-size: 16px; color: #333333;">
                    <strong>${context.author || 'Admin'}</strong> ${context.action || 'updated'} 
                    <strong>${context.itemTitle || ''}</strong>
                  </span>
                </td>
              </tr>
            </table>
          </div>

          <!-- Board/Project Info -->
          <div style="margin-bottom: 24px; margin-left: 48px;">
             <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">
                <strong>Task Group:</strong> ${context.boardName || 'To Do'}
             </div>
             <div style="font-size: 13px; color: #6b7280;">
                <strong>Project Name:</strong> ${context.projectName || 'General'}
             </div>
          </div>
          
          <!-- Comment Block (if any) -->
          ${context.commentText ? `
            <div style="margin-bottom: 24px; margin-left: 48px;">
               <div style="font-size: 12px; color: #9ca3af; margin-bottom: 8px;">
                 ${new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})}
               </div>
               <div style="font-size: 15px; color: #111827; line-height: 1.6; padding-right: 20px;">
                 ${context.commentText.replace(/\n/g, '<br/>')}
               </div>
            </div>
          ` : ''}

          <!-- Action Button -->
          <div style="margin-left: 48px; margin-top: 16px;">
            <a href="${context.buttonLink || process.env.FRONTEND_URL || 'https://trexocrm.vercel.app'}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 10px 24px; border-radius: 4px;">
              ${context.buttonText || 'View Item'}
            </a>
          </div>
        </div>
      </div>
      
    </div>
  `;

  console.log(`\n==========================================\n[DEVELOPMENT EMAIL] To: ${to} (${type})\n==========================================\n`);

  // Redirect recipient in development mode
  let recipients = Array.isArray(to) ? to : [to];
  if ((process.env.NODE_ENV === 'DEV' || process.env.NODE_ENV === 'development') && process.env.SEND_REAL_EMAILS !== 'true') {
    const devEmails = getDevEmails();
    if (devEmails.length > 0) {
      recipients = devEmails;
    }
  }

  const fromAddress = process.env.EMAIL_FROM || '"Admin" <admin@spagylo.com>';

  const emailParams = {
    Destination: {
      ToAddresses: recipients,
    },
    Message: {
      Body: {
        Html: {
          Charset: 'UTF-8',
          Data: html,
        },
      },
      Subject: {
        Charset: 'UTF-8',
        Data: subject,
      },
    },
    Source: fromAddress,
  };

  try {
    const data = await ses.sendEmail(emailParams).promise();
    console.log(`[Mailer] Email sent successfully to ${recipients.join(', ')}. Message ID: ${data.MessageId}`);
  } catch (mailErr) {
    console.warn(`[Mailer Warning] Failed to send email via SES to ${recipients.join(', ')}: ${mailErr.message}`);
  }
}

/**
 * Send a Password Reset OTP email via AWS SES
 * @param {string} to - recipient email
 * @param {string|number} otp - 6-digit OTP code
 */
async function sendOtpEmail(to, otp) {
  if (!to) return false;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f4f5f7; padding: 40px 20px;">
      <div style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="border-top: 4px solid #2563eb; text-align: center; padding: 20px 0; border-bottom: 1px solid #e5e7eb;">
          <h1 style="margin:0; font-size:20px; font-weight:700; color:#1a1d1f;">
             Trexo CRM Password Reset
          </h1>
        </div>
        <div style="padding: 32px 40px; text-align: center;">
          <h2 style="color: #1f2937; margin-bottom: 8px;">Verification Code</h2>
          <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
            Please use the verification code below to reset your password. This OTP is valid for 10 minutes.
          </p>
          <div style="display: inline-block; background-color: #f3f4f6; color: #111827; font-size: 32px; font-weight: 700; letter-spacing: 6px; padding: 12px 36px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 24px;">
            ${otp}
          </div>
          <p style="color: #9ca3af; font-size: 13px; margin: 0;">
            If you did not request a password reset, please ignore this email.
          </p>
        </div>
      </div>
    </div>
  `;

  let recipients = [to];
  if ((process.env.NODE_ENV === 'DEV' || process.env.NODE_ENV === 'development') && process.env.SEND_REAL_EMAILS !== 'true') {
    const devEmails = getDevEmails();
    if (devEmails.length > 0) {
      recipients = devEmails;
    }
  }

  const fromAddress = process.env.EMAIL_FROM || '"Admin" <admin@spagylo.com>';

  const emailParams = {
    Destination: {
      ToAddresses: recipients,
    },
    Message: {
      Body: {
        Html: {
          Charset: 'UTF-8',
          Data: html,
        },
      },
      Subject: {
        Charset: 'UTF-8',
        Data: 'Your Password Reset OTP - Trexo CRM',
      },
    },
    Source: fromAddress,
  };

  try {
    const data = await ses.sendEmail(emailParams).promise();
    console.log(`[Mailer] OTP Email sent successfully to ${recipients.join(', ')}. Message ID: ${data.MessageId}`);
    return true;
  } catch (mailErr) {
    console.warn(`[Mailer Warning] Failed to send OTP email via SES to ${recipients.join(', ')}: ${mailErr.message}`);
    return false;
  }
}

module.exports = {
  sendNotificationEmail,
  sendOtpEmail
};

