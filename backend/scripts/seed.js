require("dotenv").config();

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const { generateNextCode } = require("../utils/codeGenerator");
const User = require("../models/User");
const Client = require("../models/Client");
const Property = require("../models/Property");
const Match = require("../models/Match");

const seedUsers = [
	{
		name: "Admin",
		email: "admin@brokery.com",
		password: "Admin@DEMO_contact",
		role: "admin",
	},
	{
		name: "Shubham Kumar",
		email: "shubham@brokery.com",
		password: "Broker@Shubham",
		role: "broker",
	},
	{
		name: "Harshit Yadav",
		email: "harshit@brokery.com",
		password: "Broker@Harshit",
		role: "broker",
	},
	{
		name: "Naresh Sharma",
		email: "naresh@brokery.com",
		password: "Broker@Naresh",
		role: "broker",
	},
];

const propertySeeds = [
	{
		title: "3BHK Apartment in Dwarka Sector 12",
		propertyType: "flat",
		status: "available",
		location: {
			city: "Delhi",
			locality: "Dwarka Sector 12",
			sector: "Sector 12",
			pincode: "110078",
		},
		pricing: { askingPrice: 8500000 },
		specs: {
			area: 1450,
			bedrooms: 3,
			bathrooms: 2,
			floor: 7,
			totalFloors: 14,
			parking: true,
			furnished: "semi-furnished",
		},
		dealer: {
			name: "Capital Homes",
			phone: "9876500011",
			email: "sales@capitalhomes.in",
		},
	},
	{
		title: "4BHK Villa in Vasant Kunj",
		propertyType: "villa",
		status: "under_negotiation",
		location: {
			city: "Delhi",
			locality: "Vasant Kunj",
			sector: "Sector B",
			pincode: "110070",
		},
		pricing: { askingPrice: 24500000 },
		specs: {
			area: 3100,
			bedrooms: 4,
			bathrooms: 4,
			floor: 0,
			totalFloors: 2,
			parking: true,
			furnished: "fully-furnished",
		},
		dealer: {
			name: "South Delhi Estates",
			phone: "9876500012",
			email: "contact@southdelhiestates.in",
		},
	},
	{
		title: "Residential Plot in Rohini Sector 22",
		propertyType: "plot",
		status: "sold",
		location: {
			city: "Delhi",
			locality: "Rohini Sector 22",
			sector: "Sector 22",
			pincode: "110085",
		},
		pricing: { askingPrice: 6500000 },
		specs: {
			area: 200,
			bedrooms: 0,
			bathrooms: 0,
			floor: 0,
			totalFloors: 0,
			parking: false,
			furnished: "unfurnished",
		},
		dealer: {
			name: "North Delhi Realty",
			phone: "9876500013",
			email: "info@northeastsales.in",
		},
	},
	{
		title: "Commercial Space in Connaught Place",
		propertyType: "commercial",
		status: "available",
		location: {
			city: "Delhi",
			locality: "Connaught Place",
			sector: "Central Block",
			pincode: "110001",
		},
		pricing: { askingPrice: 48000000 },
		specs: {
			area: 5200,
			bedrooms: 0,
			bathrooms: 2,
			floor: 4,
			totalFloors: 8,
			parking: true,
			furnished: "semi-furnished",
		},
		dealer: {
			name: "Metro Commercials",
			phone: "9876500014",
			email: "leasing@metrocommercials.in",
		},
	},
	{
		title: "2BHK Apartment in Andheri West",
		propertyType: "flat",
		status: "available",
		location: {
			city: "Mumbai",
			locality: "Andheri West",
			sector: "Lokhandwala",
			pincode: "400053",
		},
		pricing: { askingPrice: 12000000 },
		specs: {
			area: 980,
			bedrooms: 2,
			bathrooms: 2,
			floor: 11,
			totalFloors: 22,
			parking: true,
			furnished: "semi-furnished",
		},
		dealer: {
			name: "West Coast Realty",
			phone: "9876500015",
			email: "hello@westcoastrealty.in",
		},
	},
	{
		title: "Sea-View 3BHK in Bandra",
		propertyType: "flat",
		status: "under_negotiation",
		location: {
			city: "Mumbai",
			locality: "Bandra West",
			sector: "Pali Hill",
			pincode: "400050",
		},
		pricing: { askingPrice: 32500000 },
		specs: {
			area: 1850,
			bedrooms: 3,
			bathrooms: 3,
			floor: 16,
			totalFloors: 28,
			parking: true,
			furnished: "fully-furnished",
		},
		dealer: {
			name: "Bandra Elite Homes",
			phone: "9876500016",
			email: "sales@bandraelitehomes.in",
		},
	},
	{
		title: "Premium Villa in Powai",
		propertyType: "villa",
		status: "sold",
		location: {
			city: "Mumbai",
			locality: "Powai",
			sector: "Hiranandani",
			pincode: "400076",
		},
		pricing: { askingPrice: 54000000 },
		specs: {
			area: 4200,
			bedrooms: 5,
			bathrooms: 5,
			floor: 0,
			totalFloors: 3,
			parking: true,
			furnished: "fully-furnished",
		},
		dealer: {
			name: "Powai Luxury Estates",
			phone: "9876500017",
			email: "info@powairealestate.in",
		},
	},
	{
		title: "Open Plot in Navi Mumbai",
		propertyType: "plot",
		status: "available",
		location: {
			city: "Mumbai",
			locality: "Panvel",
			sector: "Sector 19",
			pincode: "410206",
		},
		pricing: { askingPrice: 7800000 },
		specs: {
			area: 240,
			bedrooms: 0,
			bathrooms: 0,
			floor: 0,
			totalFloors: 0,
			parking: false,
			furnished: "unfurnished",
		},
		dealer: {
			name: "Harbour Land Deals",
			phone: "9876500018",
			email: "land@harbourdeals.in",
		},
	},
	{
		title: "Commercial Office in Lower Parel",
		propertyType: "commercial",
		status: "available",
		location: {
			city: "Mumbai",
			locality: "Lower Parel",
			sector: "Phoenix Mills",
			pincode: "400013",
		},
		pricing: { askingPrice: 39500000 },
		specs: {
			area: 4600,
			bedrooms: 0,
			bathrooms: 2,
			floor: 10,
			totalFloors: 18,
			parking: true,
			furnished: "semi-furnished",
		},
		dealer: {
			name: "Mumbai Business Spaces",
			phone: "9876500019",
			email: "team@mumbaispaces.in",
		},
	},
	{
		title: "2BHK Apartment in Whitefield",
		propertyType: "flat",
		status: "under_negotiation",
		location: {
			city: "Bangalore",
			locality: "Whitefield",
			sector: "Hope Farm",
			pincode: "560066",
		},
		pricing: { askingPrice: 9300000 },
		specs: {
			area: 1120,
			bedrooms: 2,
			bathrooms: 2,
			floor: 9,
			totalFloors: 18,
			parking: true,
			furnished: "semi-furnished",
		},
		dealer: {
			name: "East Bangalore Homes",
			phone: "9876500020",
			email: "sales@eastbangalorehomes.in",
		},
	},
	{
		title: "Luxury Villa in Koramangala",
		propertyType: "villa",
		status: "available",
		location: {
			city: "Bangalore",
			locality: "Koramangala",
			sector: "6th Block",
			pincode: "560034",
		},
		pricing: { askingPrice: 42000000 },
		specs: {
			area: 3500,
			bedrooms: 4,
			bathrooms: 4,
			floor: 0,
			totalFloors: 2,
			parking: true,
			furnished: "fully-furnished",
		},
		dealer: {
			name: "Silicon City Villas",
			phone: "9876500021",
			email: "contact@siliconcityvillas.in",
		},
	},
	{
		title: "Residential Plot in HSR Layout",
		propertyType: "plot",
		status: "sold",
		location: {
			city: "Bangalore",
			locality: "HSR Layout",
			sector: "Sector 2",
			pincode: "560102",
		},
		pricing: { askingPrice: 7200000 },
		specs: {
			area: 180,
			bedrooms: 0,
			bathrooms: 0,
			floor: 0,
			totalFloors: 0,
			parking: false,
			furnished: "unfurnished",
		},
		dealer: {
			name: "South Bangalore Lands",
			phone: "9876500022",
			email: "plots@southbangalorelands.in",
		},
	},
	{
		title: "Commercial Space in Electronic City",
		propertyType: "commercial",
		status: "available",
		location: {
			city: "Bangalore",
			locality: "Electronic City",
			sector: "Phase 1",
			pincode: "560100",
		},
		pricing: { askingPrice: 28000000 },
		specs: {
			area: 3800,
			bedrooms: 0,
			bathrooms: 2,
			floor: 6,
			totalFloors: 12,
			parking: true,
			furnished: "semi-furnished",
		},
		dealer: {
			name: "Bangalore Tech Offices",
			phone: "9876500023",
			email: "office@bangaloretechoffices.in",
		},
	},
	{
		title: "3BHK Apartment in Gachibowli",
		propertyType: "flat",
		status: "available",
		location: {
			city: "Hyderabad",
			locality: "Gachibowli",
			sector: "Financial District",
			pincode: "500032",
		},
		pricing: { askingPrice: 11500000 },
		specs: {
			area: 1500,
			bedrooms: 3,
			bathrooms: 3,
			floor: 8,
			totalFloors: 15,
			parking: true,
			furnished: "semi-furnished",
		},
		dealer: {
			name: "Hyderabad Prime Homes",
			phone: "9876500024",
			email: "sales@hydprimehomes.in",
		},
	},
	{
		title: "Luxury Villa in Jubilee Hills",
		propertyType: "villa",
		status: "under_negotiation",
		location: {
			city: "Hyderabad",
			locality: "Jubilee Hills",
			sector: "Road 36",
			pincode: "500033",
		},
		pricing: { askingPrice: 36500000 },
		specs: {
			area: 3300,
			bedrooms: 4,
			bathrooms: 4,
			floor: 0,
			totalFloors: 2,
			parking: true,
			furnished: "fully-furnished",
		},
		dealer: {
			name: "Deccan Luxury Estates",
			phone: "9876500025",
			email: "info@deccanluxuryestates.in",
		},
	},
	{
		title: "Open Plot in Kondapur",
		propertyType: "plot",
		status: "available",
		location: {
			city: "Hyderabad",
			locality: "Kondapur",
			sector: "Survey 75",
			pincode: "500084",
		},
		pricing: { askingPrice: 5900000 },
		specs: {
			area: 220,
			bedrooms: 0,
			bathrooms: 0,
			floor: 0,
			totalFloors: 0,
			parking: false,
			furnished: "unfurnished",
		},
		dealer: {
			name: "Hyderabad Land Hub",
			phone: "9876500026",
			email: "land@hydlandhub.in",
		},
	},
	{
		title: "Commercial Tower Floor in HITEC City",
		propertyType: "commercial",
		status: "sold",
		location: {
			city: "Hyderabad",
			locality: "HITEC City",
			sector: "Phase 2",
			pincode: "500081",
		},
		pricing: { askingPrice: 50000000 },
		specs: {
			area: 5500,
			bedrooms: 0,
			bathrooms: 2,
			floor: 12,
			totalFloors: 20,
			parking: true,
			furnished: "semi-furnished",
		},
		dealer: {
			name: "Tech Corridor Commercials",
			phone: "9876500027",
			email: "leasing@techcorridorcommercials.in",
		},
	},
	{
		title: "2BHK Apartment in Miyapur",
		propertyType: "flat",
		status: "available",
		location: {
			city: "Hyderabad",
			locality: "Miyapur",
			sector: "Block C",
			pincode: "500049",
		},
		pricing: { askingPrice: 6800000 },
		specs: {
			area: 1020,
			bedrooms: 2,
			bathrooms: 2,
			floor: 5,
			totalFloors: 12,
			parking: true,
			furnished: "unfurnished",
		},
		dealer: {
			name: "West Hyderabad Apartments",
			phone: "9876500028",
			email: "support@westhydapartments.in",
		},
	},
];

const clientSeeds = [
	{
		name: "Rahul Sharma",
		phone: "9876543210",
		email: "rahul.sharma@example.com",
		pipelineStage: "closed",
		monthsAgo: 0,
		requirements: {
			propertyType: "flat",
			city: "Delhi",
			locality: "Dwarka",
			minBudget: 8000000,
			maxBudget: 9000000,
			minArea: 1300,
			maxArea: 1600,
			bedrooms: 3,
		},
		notes: "Looking for a ready-to-move family home.",
	},
	{
		name: "Neha Gupta",
		phone: "9876543211",
		email: "neha.gupta@example.com",
		pipelineStage: "negotiation",
		monthsAgo: null,
		requirements: {
			propertyType: "flat",
			city: "Mumbai",
			locality: "Andheri West",
			minBudget: 11000000,
			maxBudget: 13500000,
			minArea: 900,
			maxArea: 1100,
			bedrooms: 2,
		},
		notes: "Needs quick possession and parking.",
	},
	{
		name: "Amit Patel",
		phone: "9876543212",
		email: "amit.patel@example.com",
		pipelineStage: "site_visit",
		monthsAgo: null,
		requirements: {
			propertyType: "villa",
			city: "Bangalore",
			locality: "Koramangala",
			minBudget: 30000000,
			maxBudget: 45000000,
			minArea: 2800,
			maxArea: 3800,
			bedrooms: 4,
		},
		notes: "Prefers premium gated communities.",
	},
	{
		name: "Sunita Verma",
		phone: "9876543213",
		email: "sunita.verma@example.com",
		pipelineStage: "contacted",
		monthsAgo: null,
		requirements: {
			propertyType: "commercial",
			city: "Delhi",
			locality: "Connaught Place",
			minBudget: 35000000,
			maxBudget: 50000000,
			minArea: 4000,
			maxArea: 6000,
			bedrooms: 0,
		},
		notes: "Evaluating office space options.",
	},
	{
		name: "Vikram Nair",
		phone: "9876543214",
		email: "vikram.nair@example.com",
		pipelineStage: "lead",
		monthsAgo: null,
		requirements: {
			propertyType: "flat",
			city: "Hyderabad",
			locality: "Gachibowli",
			minBudget: 10000000,
			maxBudget: 12500000,
			minArea: 1400,
			maxArea: 1700,
			bedrooms: 3,
		},
		notes: "First-time buyer, budget flexible.",
	},
	{
		name: "Deepa Menon",
		phone: "9876543215",
		email: "deepa.menon@example.com",
		pipelineStage: "closed",
		monthsAgo: 1,
		requirements: {
			propertyType: "flat",
			city: "Bangalore",
			locality: "Whitefield",
			minBudget: 8500000,
			maxBudget: 9800000,
			minArea: 1000,
			maxArea: 1250,
			bedrooms: 2,
		},
		notes: "Closed on a 2BHK near tech parks.",
	},
	{
		name: "Karan Malhotra",
		phone: "9876543216",
		email: "karan.malhotra@example.com",
		pipelineStage: "closed",
		monthsAgo: 2,
		requirements: {
			propertyType: "villa",
			city: "Mumbai",
			locality: "Powai",
			minBudget: 45000000,
			maxBudget: 55000000,
			minArea: 3800,
			maxArea: 4500,
			bedrooms: 5,
		},
		notes: "Family relocation to Mumbai.",
	},
	{
		name: "Ananya Iyer",
		phone: "9876543217",
		email: "ananya.iyer@example.com",
		pipelineStage: "closed",
		monthsAgo: 3,
		requirements: {
			propertyType: "plot",
			city: "Delhi",
			locality: "Rohini",
			minBudget: 6000000,
			maxBudget: 7500000,
			minArea: 180,
			maxArea: 250,
			bedrooms: 0,
		},
		notes: "Purchased an investment plot.",
	},
	{
		name: "Sameer Khan",
		phone: "9876543218",
		email: "sameer.khan@example.com",
		pipelineStage: "closed",
		monthsAgo: 4,
		requirements: {
			propertyType: "commercial",
			city: "Hyderabad",
			locality: "HITEC City",
			minBudget: 45000000,
			maxBudget: 52000000,
			minArea: 5000,
			maxArea: 6000,
			bedrooms: 0,
		},
		notes: "Secured office floor for expansion.",
	},
	{
		name: "Pooja Bansal",
		phone: "9876543219",
		email: "pooja.bansal@example.com",
		pipelineStage: "closed",
		monthsAgo: 5,
		requirements: {
			propertyType: "flat",
			city: "Mumbai",
			locality: "Bandra",
			minBudget: 30000000,
			maxBudget: 34000000,
			minArea: 1700,
			maxArea: 2000,
			bedrooms: 3,
		},
		notes: "Finalized sea-view apartment.",
	},
	{
		name: "Nikhil Reddy",
		phone: "9876543220",
		email: "nikhil.reddy@example.com",
		pipelineStage: "negotiation",
		monthsAgo: null,
		requirements: {
			propertyType: "flat",
			city: "Hyderabad",
			locality: "Miyapur",
			minBudget: 6500000,
			maxBudget: 7200000,
			minArea: 950,
			maxArea: 1100,
			bedrooms: 2,
		},
		notes: "Negotiating with family approval pending.",
	},
	{
		name: "Meera Joshi",
		phone: "9876543221",
		email: "meera.joshi@example.com",
		pipelineStage: "site_visit",
		monthsAgo: null,
		requirements: {
			propertyType: "villa",
			city: "Delhi",
			locality: "Vasant Kunj",
			minBudget: 22000000,
			maxBudget: 28000000,
			minArea: 2800,
			maxArea: 3400,
			bedrooms: 4,
		},
		notes: "Shortlisting premium villas.",
	},
	{
		name: "Arvind Rao",
		phone: "9876543222",
		email: "arvind.rao@example.com",
		pipelineStage: "contacted",
		monthsAgo: null,
		requirements: {
			propertyType: "commercial",
			city: "Mumbai",
			locality: "Lower Parel",
			minBudget: 35000000,
			maxBudget: 42000000,
			minArea: 4200,
			maxArea: 5000,
			bedrooms: 0,
		},
		notes: "Interested in office setup.",
	},
	{
		name: "Shreya Kapoor",
		phone: "9876543223",
		email: "shreya.kapoor@example.com",
		pipelineStage: "lead",
		monthsAgo: null,
		requirements: {
			propertyType: "plot",
			city: "Bangalore",
			locality: "HSR Layout",
			minBudget: 6500000,
			maxBudget: 8000000,
			minArea: 170,
			maxArea: 220,
			bedrooms: 0,
		},
		notes: "Early-stage investment lead.",
	},
	{
		name: "Ritika Singh",
		phone: "9876543224",
		email: "ritika.singh@example.com",
		pipelineStage: "lost",
		monthsAgo: null,
		requirements: {
			propertyType: "flat",
			city: "Delhi",
			locality: "Dwarka",
			minBudget: 7000000,
			maxBudget: 7800000,
			minArea: 1200,
			maxArea: 1400,
			bedrooms: 3,
		},
		notes: "Lead went cold after relocation changed.",
	},
];

const matchSeeds = [
	{ clientIndex: 0, propertyIndex: 0, interestLevel: "high" },
	{ clientIndex: 1, propertyIndex: 4, interestLevel: "high" },
	{ clientIndex: 2, propertyIndex: 9, interestLevel: "medium" },
	{ clientIndex: 3, propertyIndex: 3, interestLevel: "low" },
	{ clientIndex: 4, propertyIndex: 14, interestLevel: "medium" },
	{ clientIndex: 5, propertyIndex: 10, interestLevel: "high" },
	{ clientIndex: 6, propertyIndex: 6, interestLevel: "high" },
	{ clientIndex: 7, propertyIndex: 12, interestLevel: "medium" },
	{ clientIndex: 8, propertyIndex: 16, interestLevel: "low" },
];

const monthsAgo = (months, dayOffset = 0) => {
	const date = new Date();
	date.setMonth(date.getMonth() - months);
	date.setDate(date.getDate() - dayOffset);
	return date;
};

const buildClientCode = (index) => `CL-${String(index + 1).padStart(6, "0")}`;

const seed = async () => {
	await connectDB();

	try {
		console.log("Clearing existing data...");
		await Match.deleteMany({});
		await Client.deleteMany({});
		await Property.deleteMany({});
		await User.deleteMany({});

		console.log("Seeding users...");
		const hashedUsers = await Promise.all(
			seedUsers.map(async (user) => ({
				...user,
				password: await bcrypt.hash(user.password, 10),
			})),
		);
		const users = await User.insertMany(hashedUsers);

		const admin = users.find((user) => user.role === "admin");
		const brokers = users.filter((user) => user.role === "broker");

		console.log("Seeding properties...");
		const properties = [];
		for (let index = 0; index < propertySeeds.length; index += 1) {
			const propertySeed = propertySeeds[index];
			const broker = brokers[index % brokers.length];
			const askingPrice = propertySeed.pricing.askingPrice;
			const area = propertySeed.specs.area || 1;

			const property = await Property.create({
				...propertySeed,
				propertyCode: await generateNextCode(Property),
				pricing: {
					...propertySeed.pricing,
					pricePerSqft: Math.round(askingPrice / area),
				},
				addedBy: broker._id,
			});

			properties.push(property);
		}

		console.log("Seeding clients...");
		const clientsToInsert = clientSeeds.map((clientSeed, index) => {
			const broker = brokers[index % brokers.length];
			const createdAt =
				clientSeed.monthsAgo === null ?
					new Date()
				:	monthsAgo(clientSeed.monthsAgo, 7);
			const updatedAt =
				clientSeed.monthsAgo === null ?
					new Date()
				:	monthsAgo(clientSeed.monthsAgo);

			return {
				clientCode: buildClientCode(index),
				name: clientSeed.name,
				phone: clientSeed.phone,
				email: clientSeed.email,
				assignedBroker: broker._id,
				pipelineStage: clientSeed.pipelineStage,
				requirements: clientSeed.requirements,
				notes: clientSeed.notes,
				createdAt,
				updatedAt,
			};
		});

		const clients = await Client.insertMany(clientsToInsert);

		console.log("Seeding matches...");
		const matches = [];
		for (let index = 0; index < matchSeeds.length; index += 1) {
			const matchSeed = matchSeeds[index];
			const broker = brokers[index % brokers.length];

			const match = await Match.create({
				client: clients[matchSeed.clientIndex]._id,
				property: properties[matchSeed.propertyIndex]._id,
				interestLevel: matchSeed.interestLevel,
				notes: `Seeded match ${index + 1}`,
				createdBy: broker._id,
			});

			matches.push(match);
		}

		console.log(
			`Seeded ${users.length} users, ${properties.length} properties, ${clients.length} clients, and ${matches.length} matches.`,
		);
	} catch (error) {
		console.error("Seeding failed:", error.message);
		process.exit(1);
	} finally {
		await mongoose.disconnect();
		console.log("MongoDB disconnected after seeding.");
	}
};

seed();
