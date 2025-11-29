const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const files = {
  packages: path.join(DATA_DIR, "packages.json"),
  orders: path.join(DATA_DIR, "orders.json"),
  users: path.join(DATA_DIR, "users.json")
};

// Init empty files
[files.packages, files.orders, files.users].forEach(file => {
  if (!fs.existsSync(file)) fs.writeFileSync(file, "[]");
});

const load = (file) => JSON.parse(fs.readFileSync(file));
const save = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

module.exports = {
  getPackages: () => load(files.packages),
  addPackage: (pkg) => { const pkgs = load(files.packages); pkgs.push(pkg); save(files.packages, pkgs); },
  deletePackage: (id) => { const pkgs = load(files.packages).filter(p => p.id !== id); save(files.packages, pkgs); },

  getOrders: () => load(files.orders),
  addOrder: (order) => { const orders = load(files.orders); orders.push({ ...order, id: Date.now() }); save(files.orders, orders); },

  getUsers: () => [...new Set(load(files.users))],
  addUser: (phone) => {
    const users = load(files.users);
    if (!users.includes(phone)) {
      users.push(phone);
      save(files.users, users);
    }
  }
};
