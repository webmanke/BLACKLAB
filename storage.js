const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const files = {
  packages: path.join(DATA_DIR, "packages.json"),
  orders: path.join(DATA_DIR, "orders.json"),
  users: path.join(DATA_DIR, "users.json")
};

const defaultPackages = [
  { id: 1, category: "data", title: "1GB • 24hrs", price: 29 },
  { id: 2, category: "data", title: "3GB • 7 Days", price: 69 },
  { id: 3, category: "data", title: "10GB • 30 Days", price: 179 },
  { id: 4, category: "minutes", title: "100 Minutes", price: 50 },
  { id: 5, category: "sms", title: "500 SMS", price: 30 }
];

if (!fs.existsSync(files.packages)) fs.writeFileSync(files.packages, JSON.stringify(defaultPackages, null, 2));
if (!fs.existsSync(files.orders)) fs.writeFileSync(files.orders, "[]");
if (!fs.existsSync(files.users)) fs.writeFileSync(files.users, "[]");

const load = (f) => JSON.parse(fs.readFileSync(f, "utf-8"));
const save = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

module.exports = {
  getPackages: () => load(files.packages),
  addPackage: (p) => { const pkgs = load(files.packages); p.id = Date.now(); pkgs.push(p); save(files.packages, pkgs); },
  getOrders: () => load(files.orders),
  addOrder: (o) => { const orders = load(files.orders); orders.push({ ...o, id: Date.now(), time: new Date().toISOString() }); save(files.orders, orders); },
  getUsers: () => [...new Set(load(files.users))],
  addUser: (phone) => { const u = load(files.users); if (!u.includes(phone)) { u.push(phone); save(files.users, u); } }
};
