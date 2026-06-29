const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
	service: "gmail",
	auth: {
		user: process.env.EMAIL_USER,
		pass: process.env.EMAIL_PASS,
	},
});

const sendChangeRequestResolved = async ({
	toEmail,
	brokerName,
	entityType,
	action,
	adminNote,
	changes,
}) => {
	const subject = `Brokery CRM: Your ${entityType} edit request was ${action}`;
	const changesList = (changes || [])
		.map(
			(change) =>
				`<li><b>${change.field}:</b> ${change.oldValue ?? "N/A"} &rarr; ${change.newValue ?? "N/A"}</li>`,
		)
		.join("");

	const html = `
		<h2>Change Request ${String(action).toUpperCase()}</h2>
		<p>Hi ${brokerName},</p>
		<p>Your ${entityType} edit request has been <b>${action}</b>.</p>
		<ul>${changesList}</ul>
		${adminNote ? `<p><b>Admin note:</b> ${adminNote}</p>` : ""}
		<p>-- Brokery CRM</p>
	`;

	await transporter.sendMail({
		from: `"Brokery CRM" <${process.env.EMAIL_USER}>`,
		to: toEmail,
		subject,
		html,
	});
};

module.exports = { sendChangeRequestResolved };
