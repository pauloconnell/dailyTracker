const express = require("express");
const app = express();

const bodyParser = require("body-parser");
const { body, validationResult } = require("express-validator");
const cors = require("cors");
const mongoose = require("mongoose");
const shortid = require("shortid");
require("dotenv").config();
var ourUserArray = []; // this will hold our users from DB
var exerciseObject = {};
var finalDocArray = [];

//connect to DB
mongoose.connect(process.env.DB_URI2, {
  useNewUrlParser: true,
  useCreateIndex: true,
  useUnifiedTopology: true
});
console.log("mongoose is: " + mongoose.connection.readyState);
console.log(
  "readyState codes are:   0: disconnected      1: connected  2: connecting    3: disconnecting "
);
//console.log("ENV IS ", process.env.DB_URI2);

// Make Mongoose use `findOneAndUpdate()`. Note that this option is `true` by default, you need to set it to false.
mongoose.set("useFindAndModify", false);
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// set up our Schema for the DB
var logSchema = new mongoose.Schema({
  username: String,
  id: String, // storing the string version ShortId(_id) to keep it smaller for users
  count: Number,

  log: [
    {
      id: String,
      dailyCount: Number,
      description: String,
      duration: Number,
      date: String,
      time: String
    }
  ]
});

// create our model in DB collection
const exerciselogDB = mongoose.model("tracker", logSchema);
console.log("mongoose is: " + mongoose.connection.readyState);

//add static file - style.css
app.use(express.static(process.cwd() + "/public"));

//define our routes This challenge requires routes be included in server ( instead of seperating API routes to Public folder)
app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/views/index.html");
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;
  res({ error: err });
  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || "Internal Server Error";
  }
  res
    .status(errCode)
    .type("txt")
    .send(errMessage);
});

// global variable definitions:
var username;
var existingUser = false;

//These all Should be in seperate files... but this project required one big server file
// getUserID(username)
//getAllUsers
// getUserName(id)
//saveExercise

// get users id from username: called at 315
async function getUserId(username, done) {
  existingUser = false;
  var ourId;
  await exerciselogDB
    .findOne({ username: username }) //find existing, else it's new user })
    .exec()
    .then(docs => {
      if (docs) {
        // of course we would double check if this is actually our user by verifying address ect, but not required here
        existingUser = true;
        ourId = docs.id;
        console.log(
          "line 88 Existing user " + docs.username + "FOUND " + ourId
        );
        done(null, docs);
      } else {
        console.log("no docs found for " + username);
        done(null, false);
      }
    })
    .catch(err => {
      console.log(err + "Couldn't access database to check for user ID");
      done(err);
    });
}

// function to get all users:       called at line 273

async function getAllUsers(done) {
  let userList = await exerciselogDB.find({}, { id: 1, username: 1, _id: 0 });
  try {
    console.log("line 107 userlist found"); //+ Object.keys(userList))=num; //userList[Object.keys(userList)[1]])=obj@[1];
    console.log(
      "line 113 userlist 1st element is= " + JSON.stringify(userList[0])
    );
    done(null, userList);
  } catch (err) {
    console.log(err);
    done(err);
  }
}
// get username from userId called at 315
async function getUserName(id, done) {
  let thisUser = await exerciselogDB.find({ id: id });
  console.log("line 137 count is: " + thisUser[0].count);
  if (thisUser[0].username) {
    done(null, thisUser[0].username);
  } else done(null, null);
}

// function to find all users logs
async function getUserLog(id, done) {
  var userLog;
  var allUsers;
  console.log("line 134 id is " + id);
  if (!id) {
    // if no id querried, return all users
    console.log("id=null at line 146");
    await exerciselogDB.find({}, { _id: 0 }, async function(err, response) {
      if (err) {
        console.log(err);
        done(err);
      }
      if (response) {
        //  let data = response.data;
        console.log("line 151 found " + response); //JSON.stringify(data.log));
        // userLog = data;
        return done(null, response);
      } else console.log("no data at line 158");
    });
  } // if id:null closed
  if (id) {
    // else= we have id to search: (projection _id:0 prevents the _id from being displayed)
    await exerciselogDB.find({ id: id }, { _id: 0 }, async function(
      err,
      response
    ) {
      if (err) {
        console.log(err);
        done(err);
      }
      if (response) {
        let data = response.json;
        console.log("Line 178 got data ", response, data);
        return done(null, response);
      } else console.log("no data at line 181");
    });
  }
}

// this function will create our document in the database which holds log array ect
async function saveThisHasAllLogsForUser(exerciseModel, done) {
  try {
    await exerciseModel.save(done);
  } catch (err) {
    console.log("Line 209" + err);
    done(err);
  }
}
// function to save exercise log in existing DB document- called at line...241 and line 323
async function saveExercise(userId, log, done) {
  await exerciselogDB.findOne({ id: userId }, (err, data) => {
    if (err) {
      console.log("line 186" + err);
      done(err);
    } else {
      console.log("line 195", data);
      // if (data.log[data.log.length - 1].date == log.date) {
      //   console.log("matched date");
      // } else {
      // }
      data.log.push(log);
      data.count++;
      data.save((err, data) => {
        if (err) console.log("err at 194" + err + log);
        return done(null, data);
      });
    }
  });
}

// recieves submit data for user name- db will return id to use for logging exercises
app.post("/api/exercise/new-user", async function(req, res) {
  const { username } = req.body; //destructure POST variable username
  let log = []; // log will store exercise logs in the array of each user
  var date = new Date(); //  use current date

  console.log(
    "about to look up user " + username + " req is " + JSON.stringify(req.body)
  );
  console.log("connection State:" + mongoose.connection.readyState);

  // accessing db from a function call as per convention
  //if (username==null) { return res.send("Must enter username");} - Not Required as name is REQUIRED in form input

  await getUserId(username, function(err, result) {
    if (err) {
      console.log(err);
      return res.send(err);
    }
    if (result) {
      console.log("line 223 found user " + result.toString());
      res.json({ message: "username already taken id:" + result.id });
    } else existingUser = false;
  });

  //save new user's profile
  if (!existingUser) {
    console.log("Schema creation at line 230");

    const exerciseModel = new exerciselogDB({
      username: username,
      id: shortid.generate(),
      count: 0,
      log: []
    });

    try {
      await saveThisHasAllLogsForUser(exerciseModel, function(err, result) {
        if (err) {
          console.log(err + "@line 245");
        }
        if (result) {
          console.log(exerciseModel + "saved at line 248");
          return res.json({ username: result.username, _id: result.id });
        }
      });
    } catch (err) {
      console.log(err);
      return "error saving to data base" + err;
    }
  }
});

// Get api/exercise/users to get an array of all users
app.get("/api/exercise/users/", async function(req, res) {
  await getAllUsers(function(err, result) {
    // defined at line 100
    if (err) console.log(err);
    return res.send(result);
  });
});

// this is where the exercise is logged
app.post("/api/exercise/add", async function(req, res, next) {
  var dateString;
  var username;
  var { userId, description, duration, time, userName2 } = req.body;

  if (!userId) {
    res.send(
      "User ID is required field - please enter(create new user will retrieve forgotten userid)...hit refresh to continue"
    );
  }
  console.log("req.body is " + JSON.stringify(req.body));
  if (!duration) {
    // use the Unary Operator + to covert type to Number
    duration = 0;
  } else duration = parseInt(duration);
  console.log("Time entered is " + time);

  var d = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles"
  });

  console.log("todays date is ", d);
  //classDate = d.toLocaleString();

  if (time == null || time == "") {
    time = d.substr(10);
    d = d.substr(0, 8);
    console.log("sorting time ", d, time);
    // time = time.substring(0, 2);    if want hours only
  }
  d = d.substr(0, 9);
  console.log("sorting date ", d);

  console.log("this should be a string " + d);
  if (d == "Invalid Date") return res.send("invalid time - Please try again");
  var newLog = {
    id: userId,
    description: description,
    duration: duration,
    date: d,
    time: time
  };

  console.log(newLog);

  // check if we have this user
  if (!username) {
    getUserName(userId, async function(err, result) {
      if (err) console.log(err);
      else {
        // console.log("success at 308"+result);
        if (result) {
          username = result;
          //   console.log(result +"Result at line 307");
        }
        if (result == null) {
          // ie. this userID doesn't exist yet  - to pass test, must handle this:
          return res.send("Please create profile before adding exercise log");
          // could easily generate userId and register User, but Not Required so sticking to requirements
        }
      }
    });
  }
  // see if we have this username
  if (!userId) {
    getUserId(username, async function(err, result) {
      if (err) console.log(err);
      else {
        // console.log("success at 308"+result);
        if (result) {
          userId = result.userId;
          //   console.log(result +"Result at line 307");
        }
        if (result == null) {
          // ie. this userID doesn't exist yet  - to pass test, must handle this:
          return res.send("Please create profile before adding exercise log");
          // could easily generate userId and register User, but Not Required so sticking to requirements
        }
      }
    });
  }
  console.log("got id it is:", userId);
  // add the exercise

  await saveExercise(userId, newLog, async function(err, result) {
    if (err) console.log(err);
    else {
      console.log("success exercise saved at 324 "); //+result.toString());    // result of save not needed
      console.log("line 324 count is " + JSON.stringify(result.count));

      var dateString = result.log[result.count - 1].date; // cut time off the time
      // res.render("success");
      //res.redirect("/");
      res.json({
        username: result.username,
        description: result.log[result.count - 1].description,
        duration: result.log[result.count - 1].duration,
        _id: userId,
        date: result.log[result.count - 1].date,
        time: result.log[result.count - 1].time
      });
    }
  });
}); // closes this api endpoint /add

//to get user logs  querry from url     ?userName=Johnny
app.get("/api/exercise/log/:userId?/:_id?:from?/:to?/:limit?", async function(
  req,
  res
) {
  var { userId, userid, id, _id, from, to, limit } = req.query; // load userName in URL query ?userId=tara
  //user may use different terms in query, so ensure we load up userId
  if (!userId) {
    if (_id) {
      userId = _id; // incase user sends wrong name in querry
      console.log("Log for userid : " + userId);
    }
    if (id) {
      userId = id;
    }
    if (userid) {
      userId = userid;
    }
  }

  console.log(
    "api/exercise/log " +
    JSON.stringify(req.body) + //note:will be empty if clicked link from index.html
      "Line 357 from and to :" +
      from,
    to
  );
  if (from) {
    // convert String(input always type=string) to Date
    var From = new Date(from);
    console.log("from time is " + From.getTime());
    if (isNaN(From.getTime())) {
      // d.valueOf() could also work
      console.log("from date is not valid enter date yyyy-mm-dd");
      // date is not valid
      From = null;
    }
  }
  if (to) {
    var To = new Date(to); // convert to to Date
    if (isNaN(To.getTime())) {
      // d.valueOf() could also work
      // date is not valid
      console.log("from date is not valid enter date yyyy-mm-dd");
      To = null;
    }
  }
  console.log("line 379 userId =" + userId);
  await getUserLog(userId, async function(err, docs) {
    // defined at line 151 and can handle userId=null if so
    if (err) return res.send("error getting documents");
    else {
      if (docs == null || !docs) {
        console.log("warning - docs=null");
      } else {
        exerciseObject = docs; //Object.entries(docs[1]);                 can use log.count too
        count = exerciseObject[0].count;
        console.log("390 docs are found # of logs is " + count);
      }
    }
  });
  if (userId == null || userId == 0) {
    console.log("400 userId is null");
  } else {
    // below skipped if no userId

    if ((count = 0)) {
      console.log("line 406 no entries in this userObject yet ");
    }

    console.log(
      "line 410 " +
        " Access items like description : " +
        JSON.stringify(exerciseObject[0].log)
    );
  } // this ends the elseif handling defined user
  if (!To && !From && !limit) {
  }

  if (To) {
    var counter = exerciseObject[0].log.length;
    console.log(
      "line 412 " +
        exerciseObject[0].log.length +
        " is arrayLength," +
        counter +
        " and compare to date: " +
        To
    );
    let docDate = null;
    for (var i = 0; i < counter; i++) {
      try {
        console.log(
          "i is" +
            i +
            "counter is " +
            counter +
            "date is " +
            exerciseObject[0].log[i].date
        );
        docDate = new Date(exerciseObject[0].log[i].date);
        console.log("docDate is " + docDate);
      } catch (err) {
        console.log(err + " @ line 440");
      }
      console.log(
        To + To.getTime() + " is To Limit, compare date is: " + docDate
      );
      if (docDate) {
        if (To.getTime() < docDate.getTime()) {
          // if date is after 'to', delete that element
          exerciseObject[0].log.splice(i, 1);
          exerciseObject[0].count--;
          console.log(
            i +
              " is i and 450 it worked item deleted" +
              " log count is now = " +
              exerciseObject[0].count
          );
          counter--; // because we deleted this pull counter back
          i--; // same for i;
        }
      }
    }
  }
  if (From) {
    var count = exerciseObject[0].count;
    console.log("line 464 log Count is " + count);
    let docDate = null;
    for (var i = 0; i < count; i++) {
      console.log(i + " is i and line 650 date is ");
      try {
        console.log("try " + exerciseObject[0].log[i].date);
        docDate = new Date(exerciseObject[0].log[i].date);
      } catch (err) {
        console.log(err + " no data at i = " + i);
      }
      if (docDate) {
        console.log("line 470 " + docDate);

        if (From.getTime() > docDate.getTime()) {
          console.log("found 1 to delete on " + docDate);
          exerciseObject[0].log.splice(i, 1);
          exerciseObject[0].count--;
          count--; //because our exercise log list is now shorter
          i--; //this loop's counter reacts to deleted object
          console.log(
            From +
              " is 'from' Date so deleted element " +
              " count is now " +
              count +
              "=" +
              exerciseObject[0].count
          );
        }
      }
    }
    console.log(
      "line 498  Done.  Log count is " + JSON.stringify(exerciseObject[0].count)
    );
  }
  if (limit) {
    if (exerciseObject[0].log.length > limit) {
      console.log("trim results to meet limit " + limit);
      exerciseObject[0].log.splice(limit);
    }
  }

  var responseObject = {
    //_id: exerciseObject[0].id,
    username: exerciseObject[0].username,
    count: exerciseObject[0].count,
    log: exerciseObject[0].log
  }; //must use log to pass test

  if (!userId) {
    console.log("No userID, response will be :", exerciseObject);
    res.json(exerciseObject);
  } else {
    console.log("response will be :", responseObject);
    res.json(responseObject);
  }
});
// for future refference: can limit results easily using mongoose:
//   exerciseLogDB.find()
//       .where("_id")
//       .equals(userId)
//       .where("exercise.date")
//       .gt(from)
//       .lt(to)
//       .exec((err, doc) => {

app.get("/api/dailyCounts/:userId?", async function(req, res) {
  var { userId } = req.query; // load userName in URL query ?userId=tara
  var daysArray = []; // will hold [date, number of events in each day, times that day]
  var daysIndex = 0;

  await getUserLog(userId, async function(err, docs) {
    // defined at line 151 and can handle userId=null if so
    if (err) return res.send("error getting documents");
    else {
      if (docs.length<1) {
        console.log("warning - docs=null");
      } else {
        // exerciseObject = docs; //Object.entries(docs[1]);                 can use log.count too
        console.log("line 577 docs.log look like this: ", docs);

        let preResultsResponse = docs[0].log;
        console.log("pre results filter is ", preResultsResponse);
      
        //         let resultsResponse=preResultsResponse.reduce(cleanResults());

        //          function cleanResults(doc) {
        //            console.log("inside cleanResults ",doc);
        //            return [doc.date, doc.time];
        //          }

        //         let resultsResponse = docs[0].log;
        //         console.log("dig into results ", resultsResponse );
        //         resultsResponse = resultsResponse.map(cleanResults());

        //       daysArray.length == 0 && daysArray.push(docs.log[0].date); //load first date in
        console.log("docs[0].log", docs[0].log);
        res.json(docs[0].log); //resultsResponse);
      }
      //         docs.forEach((log, index) => {
      //           //
      //           if (daysArray.indexOf(docs[index].date) == -1) {
      //           //   daysIndex++; // each new day gets new array slot
      //           // }
      //           // daysArray[daysIndex][1]++; // daily event counter
      //           // daysArray[daysIndex][2].push(log.time); // 3rd slot of array is an array of times
      //           //daysArray holds [date, number of events in each day, [times that day]]
      //         //});

      //         console.log("390 docs are found # of logs is " + daysArray);
      //       }
    }
  });
});

app.get("/success", (req, res) => {
  res.sendFile(process.cwd() + "/views/success.html");
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});

//delete database - not used
// async function deleteCollectionMongoDB(done){
//   try{
//   var message=ExerciseModel.delete({});
//   done(null, message);
//   }
//   catch(err){
//       console.log(err);
//       done(err);
//     }
//     // if(){
//     //  console.log("Line 158 data ="+data);
//     //   done(null, data);
//     // }
// }

// deleteCollectionMongoDB( function(err, message){
//   console.log("attempting to delete collection now");
//   if(err){
//       console.log(err);

//     }
//     if(message){
//      console.log("Line 158 data ="+message);
//     }
// });
