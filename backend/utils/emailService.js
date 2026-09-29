const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
	service: "gmail",
	auth: {
		user: process.env.EMAIL_USER,
		pass: process.env.EMAIL_PASS,
	},
});

const escapeHtml = (value) =>
	String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");

const STATUS_TEXT = {
	approved: "approved",
	rejected: "rejected",
	conflict: "not applied because the record changed after you requested it",
};

// Pure template builder, kept separate from sending so it can be unit-tested.
const buildChangeRequestEmail = ({ brokerName, entityType, action, adminNote, changes }) => {
	const outcome = STATUS_TEXT[action] || action;
	const subject = `Brokery CRM: Your ${entityType} edit request was ${action}`;
	const changesList = (changes || [])
		.map(
			(change) =>
				`<li><b>${escapeHtml(change.field)}:</b> ${escapeHtml(change.oldValue ?? "N/A")} &rarr; ${escapeHtml(change.newValue ?? "N/A")}</li>`,
		)
		.join("");

	const html = `
		<h2>Change Request ${escapeHtml(String(action).toUpperCase())}</h2>
		<p>Hi ${escapeHtml(brokerName)},</p>
		<p>Your ${escapeHtml(entityType)} edit request was <b>${escapeHtml(outcome)}</b>.</p>
		<ul>${changesList}</ul>
		${adminNote ? `<p><b>Admin note:</b> ${escapeHtml(adminNote)}</p>` : ""}
		<p>-- Brokery CRM</p>
	`;

	return { subject, html };
};

const sendChangeRequestResolved = async ({ toEmail, ...details }) => {
	const { subject, html } = buildChangeRequestEmail(details);

	if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
		console.info(`[email disabled] would send "${subject}" to ${toEmail}`);
		return;
	}

	await transporter.sendMail({
		from: `"Brokery CRM" <${process.env.EMAIL_USER}>`,
		to: toEmail,
		subject,
		html,
	});
};

module.exports = { sendChangeRequestResolved, buildChangeRequestEmail, escapeHtml };
