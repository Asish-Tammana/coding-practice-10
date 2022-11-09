const bcrypt = require("bcrypt");
const express = require("express");
const jwt = require("jsonwebtoken");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
const path = require("path");
app.use(express.json());

let db = null;

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const initiateDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Server Running on http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initiateDBAndServer();

const changeCase = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

const authenticationToken = (request, response, next) => {
  let jwToken;
  const authHeader = request.headers["authorization"];

  if (authHeader != undefined) {
    jwToken = authHeader.split(" ")[1];
  }

  if (jwToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
    console.log("Statement 1");
  } else {
    jwt.verify(jwToken, "cdp", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
        console.log("Statement 2");
      } else {
        console.log("Statement 3");
        next();
      }
    });
  }
};

//API 1: LOGIN a user
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = bcrypt.compare(password, dbUser.password);

    if (isPasswordMatch) {
      const payload = { username: username };
      const jwToken = jwt.sign(payload, "cdp");
      response.send({ jwToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 2: GET all states API
app.get("/states/", authenticationToken, async (request, response) => {
  const getAllStatesQuery = `SELECT * FROM state;`;
  const dbResponse = await db.all(getAllStatesQuery);

  let finalList = [];

  for (let each of dbResponse) {
    const finalObj = changeCase(each);
    finalList.push(finalObj);
  }

  response.send(finalList);
});

//API 3: GET a state details
app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;

  const getStateQuery = `
    SELECT * FROM state WHERE state_id = ${stateId};`;

  let dbResponse = await db.get(getStateQuery);
  dbResponse = changeCase(dbResponse);

  response.send(dbResponse);
});

//API 4: ADD district API

app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;

  console.log(districtName);
  const addDistrictQuery = `
  INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
  VALUES(
    '${districtName}',
    '${stateId}',
    ${cases},
    ${cured},
    ${active},
    ${deaths}
  );`;

  const dbResponse = await db.run(addDistrictQuery);
  const lastId = dbResponse.lastID;
  response.send("District Successfully Added");
});

//API 5: GET a district details

app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;

    const getStateQuery = `
    SELECT * FROM district WHERE district_id = ${districtId};`;

    let dbResponse = await db.get(getStateQuery);
    dbResponse = changeCase(dbResponse);

    response.send(dbResponse);
  }
);

//API 6: DELETE district API
app.delete(
  "/districts/:districtId",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;

    const deleteDistrictQuery = `
    DELETE FROM district WHERE district_id = ${districtId};`;

    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//API 7: UPDATE district API

app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;

    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;

    const updateDistrictQuery = `UPDATE district 
            SET 
            district_name = '${districtName}',
            state_id = ${stateId},
            cases = ${cases},
            cured = ${cured},
            active = ${active},
            deaths = ${deaths}
            WHERE district_id = ${districtId}
            ;`;

    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//API 8: GET stats
app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;

    const getStatsQuery = `
    SELECT 
    sum(cases) as totalCases,
    sum(cured) as totalCured,
    sum(active) as totalActive,
    sum(Deaths) as totalDeaths
    FROM district
    WHERE state_id = ${stateId};
    `;
    const dbResponse = await db.get(getStatsQuery);
    response.send(dbResponse);
  }
);

module.exports = app;
