const {
	request,
	makeUser,
	makeClient,
	makeProperty,
	authHeader,
} = require("./factories");
const Client = require("../models/Client");
const Property = require("../models/Property");
const ChangeRequest = require("../models/ChangeRequest");
const Notification = require("../models/Notification");
const { proposeChanges } = require("../services/approvalService");
const { dispatchPending, MAX_ATTEMPTS } = require("../services/notificationService");
const emailService = require("../utils/emailService");

const patchClient = (user, client, body) =>
	request().patch(`/api/clients/${client._id}`).set(authHeader(user)).send(body);
const patchProperty = (user, property, body) =>
	request().patch(`/api/properties/${property._id}`).set(authHeader(user)).send(body);
const approve = (admin, id) =>
	request().post(`/api/change-requests/${id}/approve`).set(authHeader(admin)).send({});

const setup = async () => {
	const admin = await makeUser({ role: "admin" });
	const broker = await makeUser();
	const client = await makeClient({ broker });
	return { admin, broker, client };
};

describe("proposing changes", () => {
	test("a direct-only edit applies immediately and creates no change request", async () => {
		const { broker, client } = await setup();
		const res = await patchClient(broker, client, { phone: "9123456789" });

		expect(res.status).toBe(200);
		expect(res.body.data.applied).toEqual(["phone"]);
		expect(res.body.data.pending).toBeNull();
		expect(await ChangeRequest.countDocuments()).toBe(0);
	});

	test("resubmitting unchanged sensitive values creates no change request", async () => {
		const { broker, client } = await setup();
		// What the UI sends: the full form, with the sensitive fields untouched.
		const res = await patchClient(broker, client, {
			notes: "called today",
			pipelineStage: client.pipelineStage,
			requirements: {
				city: client.requirements.city,
				minBudget: client.requirements.minBudget,
				maxBudget: client.requirements.maxBudget,
			},
		});

		expect(res.status).toBe(200);
		expect(res.body.data.applied).toEqual(["notes"]);
		expect(res.body.data.pending).toBeNull();
		expect(await ChangeRequest.countDocuments()).toBe(0);
	});

	test("a sensitive edit creates exactly one request with only the changed field", async () => {
		const { broker, client } = await setup();
		const res = await patchClient(broker, client, {
			requirements: { minBudget: 8500000, maxBudget: client.requirements.maxBudget },
		});

		expect(res.status).toBe(202);
		const [cr] = await ChangeRequest.find().lean();
		expect(cr.changes).toEqual([
			{ field: "requirements.minBudget", oldValue: 8000000, newValue: 8500000 },
		]);
		const unchangedClient = await Client.findById(client._id).lean();
		expect(unchangedClient.requirements.minBudget).toBe(8000000);
	});

	test("admins' sensitive edits apply directly", async () => {
		const { admin, client } = await setup();
		const res = await patchClient(admin, client, { pipelineStage: "contacted" });

		expect(res.status).toBe(200);
		expect(res.body.data.applied).toEqual(["pipelineStage"]);
		expect((await Client.findById(client._id)).pipelineStage).toBe("contacted");
		expect(await ChangeRequest.countDocuments()).toBe(0);
	});

	test("proposals that would produce an invalid record are rejected up front", async () => {
		const { broker, client } = await setup();
		const res = await patchClient(broker, client, { requirements: { minBudget: 9500000 } });

		expect(res.status).toBe(400);
		expect(await ChangeRequest.countDocuments()).toBe(0);
	});

	test("fields outside the edit policy are refused", async () => {
		const { broker, client } = await setup();
		await expect(
			proposeChanges({
				entityType: "client",
				entityId: client._id,
				patch: { clientCode: "CL-999999" },
				actor: broker,
			}),
		).rejects.toMatchObject({ status: 400, code: "UNSUPPORTED_FIELDS" });
	});

	test("a newer request from the same broker supersedes and carries over the older one", async () => {
		const { broker, client } = await setup();
		await patchClient(broker, client, { requirements: { city: "Mumbai" } });
		await patchClient(broker, client, {
			requirements: { city: "Pune", maxBudget: 9500000 },
		});

		const requests = await ChangeRequest.find().sort({ createdAt: 1 }).lean();
		expect(requests.map((r) => r.status)).toEqual(["superseded", "pending"]);
		expect(requests[1].changes.map((c) => c.field).sort()).toEqual([
			"requirements.city",
			"requirements.maxBudget",
		]);
	});

	test("a different broker's overlapping pending request blocks with 409", async () => {
		const { admin, broker, client } = await setup();
		const newOwner = await makeUser();
		await patchClient(broker, client, { requirements: { city: "Mumbai" } });
		await patchClient(admin, client, { assignedBroker: newOwner._id.toString() });

		const res = await patchClient(newOwner, client, { requirements: { city: "Pune" } });
		expect(res.status).toBe(409);
		expect(res.body.code).toBe("PENDING_REQUEST_EXISTS");
	});

	test("reassigning to a user who is not an active broker is refused", async () => {
		const { admin, client } = await setup();
		const res = await patchClient(admin, client, { assignedBroker: admin._id.toString() });
		expect(res.status).toBe(400);
		expect(res.body.code).toBe("INVALID_BROKER");
	});
});

describe("resolving change requests", () => {
	test("property requests can be listed, approved and applied", async () => {
		const admin = await makeUser({ role: "admin" });
		const broker = await makeUser();
		const property = await makeProperty({ addedBy: broker });

		const proposed = await patchProperty(broker, property, {
			title: "Renamed",
			pricing: { askingPrice: 9000000 },
		});
		expect(proposed.status).toBe(200);
		expect(proposed.body.data.applied).toEqual(["title"]);

		const list = await request()
			.get("/api/change-requests?status=pending&entityType=property")
			.set(authHeader(admin));
		expect(list.body.data).toHaveLength(1);
		expect(list.body.data[0].entityId.title).toBe("Renamed");

		const res = await approve(admin, list.body.data[0]._id);
		expect(res.status).toBe(200);
		const updated = await Property.findById(property._id);
		expect(updated.pricing.askingPrice).toBe(9000000);
	});

	test("concurrent approvals apply the change exactly once", async () => {
		const { admin, broker, client } = await setup();
		await patchClient(broker, client, { pipelineStage: "contacted" });
		const cr = await ChangeRequest.findOne();
		const revisionBefore = (await Client.findById(client._id)).revision;

		const results = await Promise.all(
			Array.from({ length: 5 }, () => approve(admin, cr._id)),
		);
		const statuses = results.map((r) => r.status).sort();

		expect(statuses).toEqual([200, 409, 409, 409, 409]);
		const after = await Client.findById(client._id);
		expect(after.pipelineStage).toBe("contacted");
		expect(after.revision).toBe(revisionBefore + 1);
		expect(await Notification.countDocuments()).toBe(1);
	});

	test("exactly-once holds across 20 repeated races", async () => {
		const { admin, broker, client } = await setup();
		const stages = ["contacted", "site_visit"];

		for (let run = 0; run < 20; run += 1) {
			await patchClient(broker, client, { pipelineStage: stages[run % 2] });
			const cr = await ChangeRequest.findOne({ status: "pending" });
			const results = await Promise.all(
				Array.from({ length: 4 }, () => approve(admin, cr._id)),
			);
			expect(results.filter((r) => r.status === 200)).toHaveLength(1);
		}

		expect((await Client.findById(client._id)).revision).toBe(40); // 20 proposals + 20 approvals
		expect(await Notification.countDocuments()).toBe(20);
	});

	test("a stale request is marked as a conflict and not applied", async () => {
		const { admin, broker, client } = await setup();
		await patchClient(broker, client, { requirements: { maxBudget: 10000000 } });
		// Someone else changes the same field after the request was made.
		await patchClient(admin, client, { requirements: { maxBudget: 9500000 } });

		const cr = await ChangeRequest.findOne();
		const res = await approve(admin, cr._id);

		expect(res.status).toBe(409);
		expect(res.body.code).toBe("STALE_CHANGE_REQUEST");
		const saved = await ChangeRequest.findById(cr._id);
		expect(saved.status).toBe("conflict");
		expect(saved.conflictFields).toEqual(["requirements.maxBudget"]);
		expect((await Client.findById(client._id)).requirements.maxBudget).toBe(9500000);
	});

	test("a change that became invalid rolls back and stays pending", async () => {
		const { admin, broker, client } = await setup();
		await patchClient(broker, client, { requirements: { minBudget: 8900000 } });
		// Valid when proposed; the admin then lowers maxBudget below it.
		await patchClient(admin, client, { requirements: { maxBudget: 8500000 } });

		const cr = await ChangeRequest.findOne();
		const res = await approve(admin, cr._id);

		expect(res.status).toBe(400);
		expect((await ChangeRequest.findById(cr._id)).status).toBe("pending");
		expect((await Client.findById(client._id)).requirements.minBudget).toBe(8000000);
		expect(await Notification.countDocuments()).toBe(0);
	});

	test("rejecting leaves the record unchanged and queues a notification", async () => {
		const { admin, broker, client } = await setup();
		await patchClient(broker, client, { pipelineStage: "closed" });
		const cr = await ChangeRequest.findOne();

		const res = await request()
			.post(`/api/change-requests/${cr._id}/reject`)
			.set(authHeader(admin))
			.send({ adminNote: "Not yet" });

		expect(res.status).toBe(200);
		expect(res.body.data.status).toBe("rejected");
		expect((await Client.findById(client._id)).pipelineStage).toBe("lead");
		const notification = await Notification.findOne();
		expect(notification.payload.status).toBe("rejected");
	});

	test("the legacy /resolve endpoint still works", async () => {
		const { admin, broker, client } = await setup();
		await patchClient(broker, client, { pipelineStage: "contacted" });
		const cr = await ChangeRequest.findOne();

		const res = await request()
			.patch(`/api/change-requests/${cr._id}/resolve`)
			.set(authHeader(admin))
			.send({ action: "approved" });
		expect(res.status).toBe(200);
	});

	test("only the requester can withdraw, and only once", async () => {
		const { broker, client } = await setup();
		const other = await makeUser();
		await patchClient(broker, client, { pipelineStage: "contacted" });
		const cr = await ChangeRequest.findOne();
		const withdraw = (user) =>
			request().post(`/api/change-requests/${cr._id}/withdraw`).set(authHeader(user));

		expect((await withdraw(other)).status).toBe(403);
		expect((await withdraw(broker)).status).toBe(200);
		expect((await withdraw(broker)).status).toBe(409);
	});

	test("brokers only see their own requests", async () => {
		const { broker, client } = await setup();
		const other = await makeUser();
		await patchClient(broker, client, { pipelineStage: "contacted" });

		const res = await request().get("/api/change-requests").set(authHeader(other));
		expect(res.status).toBe(200);
		expect(res.body.data).toHaveLength(0);
	});
});

describe("notification outbox", () => {
	test("dispatch sends queued notifications once", async () => {
		const { admin, broker, client } = await setup();
		await patchClient(broker, client, { pipelineStage: "contacted" });
		await approve(admin, (await ChangeRequest.findOne())._id);

		expect(await dispatchPending()).toBe(1);
		expect(await dispatchPending()).toBe(0);
		expect(emailService.sendChangeRequestResolved).toHaveBeenCalledTimes(1);
		expect(emailService.sendChangeRequestResolved).toHaveBeenCalledWith(
			expect.objectContaining({ toEmail: broker.email, action: "approved" }),
		);
		expect((await Notification.findOne()).status).toBe("sent");
	});

	test("failures are retried with backoff and eventually marked failed", async () => {
		const { broker } = await setup();
		emailService.sendChangeRequestResolved.mockRejectedValue(new Error("SMTP down"));
		const notification = await Notification.create({
			user: broker._id,
			kind: "change_request_resolved",
			payload: { status: "approved", changes: [] },
		});

		await dispatchPending();
		let saved = await Notification.findById(notification._id);
		expect(saved.status).toBe("queued");
		expect(saved.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());

		for (let i = 1; i < MAX_ATTEMPTS; i += 1) {
			await Notification.updateOne({ _id: notification._id }, { nextAttemptAt: new Date(0) });
			await dispatchPending();
		}
		saved = await Notification.findById(notification._id);
		expect(saved.status).toBe("failed");
		expect(saved.attempts).toBe(MAX_ATTEMPTS);
		expect(saved.lastError).toBe("SMTP down");
	});
});
