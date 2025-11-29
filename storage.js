// storage.js — 100% WORKING, AUTO-CREATES EVERYTHING
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");

// FORCE CREATE FOLDER + FILES EVEN ON RENDER
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log("Created data folder");
}

const defaultPackages = [
  { id: 1, category: "data", title: "1GB • 24hrs", price: 29 },
  { id: 2, category: "data", title: "3GB • 7 Days", price: 69 },
  { id: 3, category: "data", title: "10GB • 30 Days", price: 179 },
  { id: 4, category: "data", title: "Unlimited Night", price: 49 },
  { id: 5, category: "minutes", title: "100 Minutes", price: 50 },
  { id: 6, category: "sms", title: "500 SMS", price: 30 }
];

const files = {
  packages: path.join(DATA_DIR, "packages.json"),
  orders: path.join(DATA_DIR, "orders.json"),
  users: path.join(DATA_DIR, "users.json")
};

// Auto-create files with default data if missing
if (!fs.existsSync(files.packages)) {
  fs.writeFileSync(files.packages, JSON.stringify(defaultPackages, null, 2));
  console.log("Created packages.json with default bundles");
}
if (!fs.existsSync(files.orders)) {
  fs.writeFileSync(files.orders, "[]");
  console.log("Created orders.json");
}
if (!fs.existsSync(files.users)) {
  fs.writeFileSync(files.users, "[]");
  console.log("Created users.json");
}

const load = (file) => JSON.parse(fs.readFileSync(file, "utf-8"));
const save = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

module.exports = {
  getPackages: () => load(files.packages),

  addPackage: (pkg) => {
    const pkgs = load(files.packages);
    pkg.id = Date.now();
    pkgs.push(pkg);
    save(files.packages, pkgs);
  },

  deletePackage: (id) => {
    const pkgs = load(files.packages).filter(p => p.id !== id);
    save(files.packages, pkgs);
  },

  getOrders: () => load(files.orders),

  addOrder: (order) => {
    const orders = load(files.orders);
    orders.push({ ...order, id: Date.now(), timestamp: new Date().toISOString() });
    save(files.orders, orders);
  },

  getUsers: () => {
    const users = load(files.users);
    return [...new Set(users)];
  },

  addUser: (phone) => {
    const users = load(files.users);
    if (!users.includes(phone)) {
      users.push(phone);
      save(files.users, users);
    }
  }
};
