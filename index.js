console.log("this file has been loaded :)");

document.getElementById("resultsButton").onclick = async function() {
  //hit api to get data

  let userName = document.getElementById("successUserName").value;
  let myObject = await fetch("//api/dailyCounts/?userId=" + document);
  console.log(myObject);
  //let myText = await myObject.text();
  let display = document.getElementsById("displayResults");

  display.innerText = myObject;

  // iterate through data to display on screen
};
