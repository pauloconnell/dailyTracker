const express = require("express");
const app = express();

const bodyParser = require("body-parser");
const { body, validationResult } = require("express-validator");
const cors = require("cors");
const mongoose = require("mongoose");
const shortid = require("shortid");
var ourUserArray = []; // this will hold our users from DB
var exerciseObject = {};
var finalDocArray = [];

//connect to DB
mongoose.connect(process.env.DB_URI, {
  useNewUrlParser: true,
  useCreateIndex: true
});

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
      date: String
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
  let ourId;
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
      "line 113 userlist 3rd element is= " + JSON.stringify(userList[3])
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
  if (id == null) {
    // if no id querried, return all users
    console.log("id=null at line 146");
    await exerciselogDB.find({}, { _id: 0 }, async function(err, data) {
      if (err) {
        console.log(err);
        done(err);
      }
      if (data) {
        console.log("line 151 found " + JSON.stringify(data.log));
        userLog = data;
        return done(null, userLog);
      } else console.log("no data at line 158" + data);
    });
  } // if id:null closed
  else {
    // else= we have id to search: (projection _id:0 prevents the _id from being displayed)
    await exerciselogDB.find({ id: id }, { _id: 0 }, async function(err, data) {
      if (err) {
        console.log(err);
        done(err);
      }
      if (data) {
        console.log("Line 178 got data for " + data[0].username);
        return done(null, data);
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
      data.log.push(log);
      data.count++;
      data.save((err, data) => {
        if (err) console.log("err at 194" + err);
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
  var classDate;
  var dateString;
  var timeString;
  var username;
  var { userId, description, duration, date } = req.body;

  if (!userId || !description || !duration) {
    res.send(
      "User ID, Description and Duration are required fields - please enter values...hit refresh to continue"
    );
  }
  console.log("req.body is " + JSON.stringify(req.body));
  if (+duration == NaN) {
    // use the Unary Operator to covert type to Number
    return res.send("please enter proper duration in minutes ");
  } else duration = parseInt(duration);
  console.log("Date is " + date);
  if (date == null || date == "") {
    date = new Date();
  }
  classDate = new Date(date);
  dateString = classDate.toString();
  timeString = classDate.getHours();

  console.log("this should be a string " + dateString);
  if (dateString == "Invalid Date")
    return res.send("invalid date - Please try again");
  var newLog = {
    id: userId,
    description: description,
    duration: duration,
    date: dateString.substr(0, 15),
    time: timeString
  };
  // check if we have this user
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
        date: dateString.substr(0, 15),
        time: dateString.getHours
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

  console.log(JSON.stringify(req.body) + "Line 357 from and to :" + from, to);
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
    _id: exerciseObject[0].id,
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
  var daysArray = [];
  await getUserLog(userId, async function(err, docs) {
    // defined at line 151 and can handle userId=null if so
    if (err) return res.send("error getting documents");
    else {
      if (docs == null || !docs) {
        console.log("warning - docs=null");
      } else {
        // exerciseObject = docs; //Object.entries(docs[1]);                 can use log.count too

        for (const count in docs) {
          //
          daysArray.length == 0 && daysArray.push(count.time); //load first time in - each day has
          if (daysArray[daysArray.length - 1].date == count.date)
            daysArray.push(count.time);

          // idea:
          // have array of times represent each day within each slot of array of days
          // to be cont
        }

        console.log("390 docs are found # of logs is " + daysArray);
      }
    }
  });
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
