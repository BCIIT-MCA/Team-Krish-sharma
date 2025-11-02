const express = require("express");
const app = express();
const path = require("path");


const port = 8080;


app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");

// ROUTES
app.get("/", (req, res) => {
  res.render("home.ejs");
});

app.get("/about", (req, res) => {
  res.render("about.ejs");
});




app.listen(port, () => {
  console.log(`🧠 Neuro-Alert running on http://localhost:${port}`);
});
