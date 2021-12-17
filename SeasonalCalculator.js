import React, { Component, createRef, useEffect, useState, useContext }                                 from 'react';
import { ScrollView, StyleSheet, Text, View, Switch, TextInput, Image, Dimensions, useWindowDimensions} from 'react-native';
import RNPickerSelect                                                                                   from 'react-native-picker-select'
import { NavigationActions }                                                                            from 'react-navigation';
import { Button }                                                                                       from 'react-native-elements';
import { useOrientation }                                                                               from '../Functions/useOrientation';

  
import {Fund}                                                                                           from '../Arrays'
import {Month}                                                                                          from '../Arrays'
import {HolidayArray}                                                                                   from '../HolidayCheckers/HolidayArray'
import {nonce, email, sessionID, nonce_exp, setNonce, setEmail, setSessionID, setNonceEXP}              from '../Variables'
import {selectedStrategyID, setSelectedStrategyID}                                                      from '../Variables'
import AppContext                                                                                       from '../ContextData';
import BlankSpace                                                                                       from '../Functions/blankSpace'
import convertMonthToNumbers                                                                            from '../Functions/convertMonthToNumbers'
import formatDate                                                                                       from '../Functions/formatDate'
import getDate                                                                                          from '../serverFunctions/getDate'
import getDailyChangePrices                                                                             from '../serverFunctions/getDailyChangePrices'
import getEasterDate                                                                                    from '../HolidayCheckers/getEasterDate'
import getSharePrices                                                                                   from '../serverFunctions/getSharePrices'
import getWatchLists                                                                                    from '../serverFunctions/getWatchLists'
import helpSetSharePrices                                                                               from '../Functions/helpSetSharePrices';
import HolidayChecker                                                                                   from '../Functions/HolidayChecker'
import initializeDefaultTextArray                                                                       from '../Functions/initializeDefaultTextArray'
import initializeSubmissionArray                                                                        from '../Functions/initializeSubmissionArray'
import initializeSwitchArray                                                                            from '../Functions/initializeSwitchArray'
import initializeTradeArray                                                                             from '../Functions/initializeTradeArray'
import isBankHoliday                                                                                    from '../Functions/isBankHoliday'
import LoginPopUp                                                                                       from '../Components/loginOverlay';
import processResponseHelper                                                                            from '../Functions/processResponseHelper'
import seperateStrategies                                                                               from '../Functions/seperateStrategies'
import strategySubmissionHandler                                                                        from '../serverFunctions/strategySubmissionHandler'
import submitHandler                                                                                    from '../serverFunctions/submitHandler'
import submitSeasonalStrategies                                                                         from '../serverFunctions/submitSeasonalStrategies'
import { useNavigation }                                                                                from '@react-navigation/native';
import                                                                                                  'intl';
import                                                                                                  'intl/locale-data/jsonp/en'; 

//these imports are used for push notifications
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';


//temporary functions (to be deleted)
import initializeDefaultTextArray2                                                                      from '../Functions/initializeDefaultTextArray2'
import { date_parse } from 'locutus/php/datetime';

//these variables are used for push notifications
let notificationListener = createRef();
let responseListener = createRef();

//default label values
const benchDefault = "Not Selected"

//this is used to store the frequency at which the app checks for share price updates
let _interval = 0;
let clearPerformed = false;

//used to help set dates
let tester = false;

//used to pass strategyID to different screens
let strategyID = ''

//Defining the months so they can be written vertically
let monthArray = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
let strategyNamesArray = ['G', 'F', 'C', 'S', 'I', 'mjedlin66', 'jahbulon', 'TSPcenter', 'tmj100', 'Matt', 'Jerin', 'Travis', 'Larry', 'Deena']

let lastUpdater = 0;
let timerCount  = 0;

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

//styling for the picker
const pickerSelectStyles = StyleSheet.create({
  inputIOS: {
    fontSize: 16,
    paddingTop: 13,
    paddingHorizontal: 10,
    paddingBottom: 12,
    borderWidth: 1,
    width: (windowWidth - 83)/2,
    borderColor: 'gray',
    borderRadius: 4,
    backgroundColor: 'white',
    color: 'black',
    height: 40,
    margin: .5
  },
  inputAndroid: {
    fontSize: 16,
    paddingTop: 13,
    paddingHorizontal: 10,
    paddingBottom: 12,
    borderWidth: 1,
    width: (windowWidth - 83)/2,
    borderColor: 'gray',
    borderRadius: 4,
    backgroundColor: 'white',
    color: 'black',
    height: 41,
    margin: .5
},
});

//placeholder for date pickers
let dayPlaceholder = {
  label: 'Select Date',
  value: '0',
}

//placeholder for fund pickers
let fundPlaceholder = {
  label: 'Select Fund',
  value: 'X',
}

//requires are listed here
var strtotime = require('locutus/php/datetime/strtotime')
var { DateTime } = require('luxon');

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});  

export default function TSPBeta({route, props}) {    

  //variable to track screen orientation
  let orientation = useOrientation();

  const { watchLists, loginData, logUserOut } = route.params

  const [refreshPage, setRefreshPage] = useState ("");

  //constructs the trade array.  trade[11][2] is the result
  const [trade, setTrade]                                     = useState(initializeTradeArray(12, 3))
  //constructs the benchMarks array.  benchMarks[14] is the result
  const [benchMarks, setBenchMarks]                           = useState(initializeSubmissionArray(15))
  const [strategies, setStrategies]                           = useState(initializeSubmissionArray(1))
  //constructs the array that will set the display values for the returned strategy response
  const [strategyResponse, setStrategyResponse]               = useState(initializeDefaultTextArray(12, 3))
  //*s are used as default placeholders for the submit function.  If not changed they will be filtered out
  const [ID, setID]                                           = useState('*')
  const [stratNum, setStratNum]                               = useState('*')
  //defaultText is used to place the strategies submit result into the input fields 
  const [defaultText, setDefaultText]                         = useState(initializeDefaultTextArray(12, 3))
  const [resultsToSend, setResultsToSend]                     = useState([])
  const [tableOfResults, setTableOfResults]                   = useState([])
  const [landscapeTableOfResults, setLandscapeTableOfResults] = useState([])
  //waits for the processResponse function to complete, then allows the graph and table to display the results
  const [loading, setLoading]                                 = useState(true)
  //determines if the app has loaded all of the needed initial data
  const [dataLoaded, setDataLoaded]                           = useState(false)
  //used to determine if the table has auto updated today
  const [dataAutoUpdatedToday, setDataAutoUpdatedToday]       = useState(0)
  //variables for handling logging in
  const [loggedIn, setLoggedIn]                               = useState(false)
  const [emailValue, setEmailValue]                           = useState(' ')
  const [selectedValue, setSelectedValue]                     = useState(' ')
  const [switchArray, setSwitchArray]                         = useState(initializeSwitchArray())
  //these variables are used for push notifications
  const [expoPushToken, setExpoPushToken]                     = useState('')
  const [notification, setNotification]                       = useState(false)
  const [dataLoading, setDataLoading]                         = useState(false)
  const myContext = useContext(AppContext);
  
  let monthDropDowns = generateMonthDropdowns()
  let strategyDropDowns = generateStrategyDropdowns()

  const navigation = useNavigation();

  // Can use this function below, OR use Expo's Push Notification Tool-> https://expo.io/notifications
  async function sendPushNotification(expoPushToken) {
    const message = {
      to: expoPushToken,
      sound: 'default',
      title: 'Original Title',
      body: 'And here is the body!',
      data: { someData: 'goes here' },
    };

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
  }

  async function registerForPushNotificationsAsync() {
    let token;
    if (Constants.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        alert('Failed to get push token for push notification!');
        return;
      }
      token = (await Notifications.getExpoPushTokenAsync()).data;
      //console.log(token);
    } else {
      alert('Must use physical device for Push Notifications');
    }

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return token;
  }

  function handleChangeOption(val) {
    if (val !== 0) {
      setSelectedValue(val)
    }
  }

  mainHandler = sessionHandler.bind(this);

  useEffect(() => {  
    blankOutEmail(logUserOut)
  }, [logUserOut]);

  function blankOutEmail(response){
      //email is put into state so that "welcome back --email address here--" can be displayed
      setEmailValue('')
  }

  useEffect(() => {  
    sessionHandler(myContext.userLoggedIn)
  }, [myContext.userLoggedIn]);

  function sessionHandler(response){
    if(response !== 'NYD'){
      //email is put into state so that "welcome back --email address here--" can be displayed
      setEmailValue('Welcome back ' + response['auth']['email'])
      setEmail(response['auth']['email']);
      setNonce(response['auth']['nonce']);
      setNonceEXP(response['auth']['nonce_exp']);
      setSessionID(response['auth']['session_id']);
      setLoggedIn(true)
      getWatchLists(response['auth']['email'], response['auth']['nonce'], response['auth']['session_id']).then((response) => getGraphsForWatchList(response)).catch((error)=>{
        console.log("Error Calling Get Graphs For Watch List");
        alert(error.message);
      })
    }
  }

  /* ---- No Longer Used ----
  //sets the async value to be passed to myWatchList
  setMe = async (response) => {
    try {
      await AsyncStorage.setItem('@MyWatchList', response)
    } catch (e) {
      console.log(e)
    }
  }
  */

  //call the main server to get the mean etc for the watch list graphs
  function getGraphsForWatchList(response){

    //saving the watch list data to be sent over to the watch list screen
    let watchListData = response;
    let strategiesArray = [];
    setEmail(response['auth']['email']);
    setNonce(response['auth']['nonce']);
    setNonceEXP(response['auth']['nonce_exp']);
    setSessionID(response['auth']['session_id']);

    response['watchlist'].map((object, index) => strategiesArray[index] = object.strategyID)
    submitHandler([], strategiesArray, email, nonce, sessionID).then(response => sendResultsToWatchList(response, watchListData))
  }


  //this code both updates the nonce and sends the watch list data over to the watch list screen to be processed
  function sendResultsToWatchList(response, watchListData){
    setEmail(response['auth']['email']);
    setNonce(response['auth']['nonce']);
    setNonceEXP(response['auth']['nonce_exp']);
    setSessionID(response['auth']['session_id']);

    //value to grab totals with
    let tot = 0;

    let processedArray = processResponseHelper(response);

    //grabbing the values for the watch lists
    for(let i = 0; i < processedArray[2][0][processedArray[2][0].length - 1].length; i++){
      //grabbing the std devs
      watchListData['watchlist'][i].stdDev = processedArray[2][0][processedArray[2][0].length - 1][i];
      //grabbing the means
      watchListData['watchlist'][i].mean   = processedArray[2][0][processedArray[2][0].length - 2][i];
      //grabbing the totals
      tot = 0;
      for(let j = 0; j < (processedArray[2][0].length - 2); j++){
        if(j == 0){
          tot = 1 + (parseFloat(processedArray[2][0][j][i] * .01))
        }
        else{
          tot = tot * ((parseFloat(processedArray[2][0][j][i]) * .01) + 1);
        }
      }
      tot = tot - 1
      tot = tot * 100
      watchListData['watchlist'][i].total = tot;
    }
    myContext.setWatchListDataValue(watchListData)
    //navigation.navigate('MyWatchList', { yearlyValues: processedArray[2] })
  }
  
  //first step: loads the G, F, C, S, and I values from the server and stores them
  function loadInitialData(){
    //console.log(myContext.userLoggedIn)
    if(dataLoaded == true){
      return
    }
    else{

      //setting initial parameters for the Daily screen
      navigation.navigate('Daily Page',{fundChange: 'NYD', initialized: false, lastUpdate: 'NYD'});
      navigation.goBack();

      let date = new Date();
      let month = 0;
      let year = date.getFullYear();
      let easterDate = getEasterDate(year)
      let numDays = 0;
      easterDate = easterDate.slice(8)
      //accounting for the fact we want good friday
      easterDate = easterDate - 2;
      //build the calendar arrrays that are used for the calendar screen
      for(let h = 0; h < 12; h++){
        //getting the correct month value
        if(h < 10){
          month = '0' + (h)
        }
        else{
          month = h
        }
        for(let i = 0; i < HolidayArray[h].length; i++){
          date = new Date(year, month, (i+1))
          tester = HolidayChecker(date)
          //this code accounts for all of the holidays
          if(tester == false && date.getDay() !== 0 && date.getDay() !== 6){
            setHolidayDate(h, numDays)
          }
          if(month == 6 && i == 3){
            setHolidayDate(h, numDays)
          }
          //Sunday
          if (date.getDay() == 0){
            if(tester == false){
              HolidayArray[h][i + 1] = false;
              i++;
            }
            tester = false;
          }
          //Saturday
          else if(date.getDay() == 6){            
            if(tester == false){
              HolidayArray[h][i - 1] = false;
            }
            tester = false;           
          }
          if(h == 3){
            if((i + 1) == easterDate){
              tester = false;
            }            
          }
          //incrementing the # business days
          if(tester == true){
            numDays++
          }       
          HolidayArray[h][i] = tester
        }
        //setting the total number of business days
        HolidayArray[h]['numBusinessDays'] = numDays;
        numDays = 0;
      }

      //this dispatches 'NYD' to the respective screens, which tells each screen that the proper data hasn't been loaded yet
      navigation.navigate('MyWatchList', { watchLists: 'NYD' })
      navigation.goBack();

      navigation.navigate('Calendar', {passedInCalendarData: 'NYD', passedInStrategyID: 'NYD'});
      navigation.goBack();

      navigation.navigate('Strategies', { strategyData: 'NYD' })
      navigation.goBack();

      getDailyChangePrices(email, nonce, sessionID).then((response) => setDateOfLastUpdate(response)).catch((error)=>{
        console.log("Api call error");
        alert(error.message);
     })
    }
  }

  function setHolidayDate(month, validDays){
    switch(month) {
      case 0:
        if(validDays > 5){
          HolidayArray[month]['1MK'] = validDays
          HolidayArray[month]['2MK'] = validDays - 1
          HolidayArray[month]['3MK'] = validDays - 2
          HolidayArray[month]['MK1'] = validDays + 1
          HolidayArray[month]['MK2'] = validDays + 2
          HolidayArray[month]['MK3'] = validDays + 3
        }
        break;
      case 1:
        HolidayArray[month]['1MK'] = validDays 
        HolidayArray[month]['2MK'] = validDays - 1
        HolidayArray[month]['3MK'] = validDays - 2
        HolidayArray[month]['MK1'] = validDays + 1
        HolidayArray[month]['MK2'] = validDays + 2
        HolidayArray[month]['MK3'] = validDays + 3
        break;
      case 4:
        HolidayArray[month]['1MD'] = validDays 
        HolidayArray[month]['2MD'] = validDays - 1
        HolidayArray[month]['3MD'] = validDays - 2
        break;
      case 6:
        if(validDays < 5){
          HolidayArray[month]['1ID'] = validDays 
          HolidayArray[month]['2ID'] = validDays - 1
          HolidayArray[month]['ID1'] = validDays + 1
          HolidayArray[month]['ID2'] = validDays + 2
          HolidayArray[month]['ID3'] = validDays + 3
        }
        break;
      case 8:
        HolidayArray[month]['LD1'] = validDays + 1
        HolidayArray[month]['LD2'] = validDays + 2
        HolidayArray[month]['LD3'] = validDays + 3
        break;
      case 9:
        HolidayArray[month]['1CD'] = validDays 
        HolidayArray[month]['2CD'] = validDays - 1
        HolidayArray[month]['3CD'] = validDays - 2
        HolidayArray[month]['CD1'] = validDays + 1
        HolidayArray[month]['CD2'] = validDays + 2
        HolidayArray[month]['CD3'] = validDays + 3
        break;
      case 10:
        if(validDays < 10){
          HolidayArray[month]['1VD'] = validDays 
          HolidayArray[month]['2VD'] = validDays - 1
          HolidayArray[month]['3VD'] = validDays - 2
          HolidayArray[month]['VD1'] = validDays + 1
          HolidayArray[month]['VD2'] = validDays + 2
          HolidayArray[month]['VD3'] = validDays + 3
        }
        else{
          HolidayArray[month]['1TH'] = validDays 
          HolidayArray[month]['2TH'] = validDays - 1
          HolidayArray[month]['3TH'] = validDays - 2
          HolidayArray[month]['TH1'] = validDays + 1
          HolidayArray[month]['TH2'] = validDays + 2
          HolidayArray[month]['TH3'] = validDays + 3
        }
        break;
      case 11:
        HolidayArray[month]['1CH'] = validDays 
        HolidayArray[month]['2CH'] = validDays - 1
        HolidayArray[month]['3CH'] = validDays - 2
        HolidayArray[month]['CH1'] = validDays + 1
        HolidayArray[month]['CH2'] = validDays + 2
        HolidayArray[month]['CH3'] = validDays + 3
      break;
      default:
        // code block
    } 
  }


  //the second step of the loadInitialData function
  function setDateOfLastUpdate(response){
    setEmail(response['auth']['email']);
    setNonce(response['auth']['nonce']);
    setNonceEXP(response['auth']['nonce_exp']);
    setSessionID(response['auth']['session_id']);
    
    setDataLoaded(true)
    lastUpdater = response
    getSharePrices(email, nonce, sessionID).then((response) => setSharePrices(response)).catch((error)=>{
      console.log("Api call error");
      alert(error.message);
   })    
  }



  //the third step of the loadInitialData function, calculates the prices for the Share Prices table
  function setSharePrices(response){
    setEmail(response['auth']['email']);
    setNonce(response['auth']['nonce']);
    setNonceEXP(response['auth']['nonce_exp']);
    setSessionID(response['auth']['session_id']);
    let fundChangeArray = helpSetSharePrices(response, lastUpdater)
    getSeasonalStrategies(fundChangeArray)
  }

  //the fourth step of the initialization process (gets seasonal strategies data)
  function getSeasonalStrategies(fundChangeArray){
    let initialSubmitter = 'NYD'
    submitSeasonalStrategies(initialSubmitter, email, nonce, sessionID).then((response => setSeasonalStrategies(response, fundChangeArray)))
  }

  //the fifth step of the initialization process (sets seasonal strategies data)
  function setSeasonalStrategies(response, fundChangeArray){
    setEmail(response['auth']['email']);
    setNonce(response['auth']['nonce']);
    setNonceEXP(response['auth']['nonce_exp']);
    setSessionID(response['auth']['session_id']);

    navigation.navigate('Strategies', { strategyData: response })
    navigation.goBack();

    doneInitializing(fundChangeArray);
  }


  //the sixth and final step, this function tells the fund table with percent changes to display itself
  function doneInitializing(fundChangeArray){

    navigation.navigate('Daily Page',{fundChange: fundChangeArray, initialized: true, lastUpdate: lastUpdater});
    navigation.goBack();

  }

  
  //the purpose of this function is to get the users selected benchmarks ready for submission and then to submit them
  function benchmarkPressed(){

    //this sets the button it its loading state
    setDataLoading(true)

    //the users typed in benchmarks get copied to a variable
    let addMeToBenchmarks = ID;

    //creates copies of the array instead of editing the original array
    let editBenchMarks = [...benchMarks];

    //gets rid of unwanted characters and splits the string into an array of values (uses commas to seperate)
    addMeToBenchmarks  = seperateStrategies(addMeToBenchmarks);

    //adds typed in benchmarks onto the array of selected benchmarks
    if(addMeToBenchmarks != ''){
      editBenchMarks     = editBenchMarks.concat(addMeToBenchmarks);
    }
    
    //gets rid of * values in the array.  *s are used as default placeholders
    editBenchMarks     = editBenchMarks.filter((n) => {return n != '*'});

    //submits the result, note the .then function that waits for the results before continuing
    submitHandler(strategyResponse, editBenchMarks, email, nonce, sessionID).then((response) => processResponse(response)).catch((error)=>{
      console.log("Api call error");
      alert(error.message);
   })
  }
  
  //this function is called when the go to strategy button is pressed
  function goToStrategyPressed(){
    setDataLoading(true)
    //the users typed in benchmark gets copied to a variable
    strategyID = stratNum
    setSelectedStrategyID(stratNum)
    let editStratNum      = stratNum;
    editStratNum = editStratNum.replace(/\D/g,''); 
    strategySubmissionHandler(editStratNum, email, nonce, sessionID).then((response) => processStrategyResponse(response)).catch((error)=>{
      console.log("Api call error");
      alert(error.message);
   }) 
  }

  //this function is called when the go to strategy button is pressed
  function addStrategyPressed(){
    setDataLoading(true)
    //submits the result, note the .then function that waits for the results before continuing
    submitHandler(strategyResponse, editBenchMarks, email, nonce, sessionID).then((response) => addStrategyPressedPart2(response)).catch((error)=>{
      console.log("Api call error");
      alert(error.message);
   })
  }

  //this function is called when the go to strategy button is pressed
  function addStrategyPressedPart2(response){
    setDataLoading(false)
    console.log(response)
  }

  //this function is called when the go to strategy button is pressed from the watchlists screen
  function goToStrategyPressed2(strategy){
    strategyID = strategy
    setSelectedStrategyID(strategy)
    let editStratNum      = strategy;
    editStratNum = editStratNum.replace(/\D/g,''); 
    //the users typed in benchmark gets copied to a variable
    strategySubmissionHandler(strategy, email, nonce, sessionID).then((response) => processResponse2(response)).catch((error)=>{
      console.log("Api call error");
      alert(error.message);
    }) 
  }
  

  //This function processes the response, performs the appropriate math, and puts the results into arrays for the graph (lineGraph.js) and table (table.js) functions 
  function processResponse(response){
    //pulling the login info from the response array
    setEmail(response['auth']['email']);
    setNonce(response['auth']['nonce']);
    setNonceEXP(response['auth']['nonce_exp']);
    setSessionID(response['auth']['session_id']);


    let processedArray = processResponseHelper(response)
    setResultsToSend(processedArray[0])
    setTableOfResults(processedArray[1])
    setLandscapeTableOfResults(processedArray[2])
    setLoading(false)
    setDataLoading(false)
    navigation.navigate('Graphs', {GraphData : processedArray[0]});
    navigation.navigate('Tables', {resultsToSend : processedArray[0], tableOfResults : processedArray[1], landscapeTableOfResults: processedArray[2]});
  }

  //This function processes the response, performs the arppropriate math, and puts the results into arrays for the graph and table functions.  The difference between 
  //this and processResponse is that this processes the strategy response afterwards
  function processResponse2(response){
    //pulling the login info from the response array
    setEmail(response['auth']['email']);
    setNonce(response['auth']['nonce']);
    setNonceEXP(response['auth']['nonce_exp']);
    setSessionID(response['auth']['session_id']);

    let processedArray = processResponseHelper(response)
    setResultsToSend(processedArray[0])
    setTableOfResults(processedArray[1])
    setLandscapeTableOfResults(processedArray[2])
    setLoading(false)
    setDataLoading(false)
    //props.navigation.navigate('Graphs', {GraphData : processedArray[0]});
    //props.navigation.navigate('Tables', {resultsToSend : processedArray[0], tableOfResults : processedArray[1], landscapeTableOfResults: processedArray[2]});
    processStrategyResponse(response)
  }

  //this function processes the response from the go to strategy button
  function processStrategyResponse(response){

    //this resets the button so it isn't a spinning wheel
    setDataLoading(false)

    //pulling the login info from the response array
    setEmail(response['auth']['email']);
    setNonce(response['auth']['nonce']);
    setNonceEXP(response['auth']['nonce_exp']);
    setSessionID(response['auth']['session_id']);

    navigation.navigate('Calendar', { passedInCalendarData: response['response'][0]['trades'], passedInStrategyID: strategyID} )
    navigation.goBack();

    let tempArray = initializeDefaultTextArray(12, 3)
    //checks if the response is an empty array
    if(response['response'].length < 1 || response['response'] == undefined){
      alert('Strategy ID does not exist.')
    }
    //checks to see if there are no errors
    else if(response['response'][0]['errors'] == null){
      response = response['response'][0]['trades']
      for(let i = 0; i < response.length; i++){
        for(let j = 0; j < response[i].length; j++){
          tempArray[i][j]['day'] = response[i][j]['day']
          tempArray[i][j]['fund'] = response[i][j]['fund']
        }
      }
      //perform the update
      setStrategyResponse(tempArray)
    }
    //reports the error if one is found
    else{
      alert(response['response'][0]['errors'][0]['description'])
    }
  }

  //these functions are for settings variables
  function setResults(response){
    setResults(response)
  }


  function handleID(text){
    setID(text)
  }


  function handleStratNum(text){
    setStratNum(text)
  }


  function responseHandler(response, firstParam, secondParam, text){
    let editTrade = [...strategyResponse];
    editTrade[firstParam][secondParam][text] = response;
    setStrategyResponse(editTrade)
  }

  function handleSwitchChange(param, index){
    let switchArrayCopy = [...switchArray]
    let benchmarksCopy = [...benchMarks]
    let changeValue = !switchArray[index]
    switchArrayCopy[index] = changeValue
    if(changeValue == false){
      benchmarksCopy[index] = '*'
      setBenchMarks(benchmarksCopy)
    }
    else{
      benchmarksCopy[index] = strategyNamesArray[index]
      setBenchMarks(benchmarksCopy)
    }
    setSwitchArray(switchArrayCopy)    
  }


  //this function checks to see if the time is between 5 pm and 9 pm eastern, and if todays date is valid.  If it is a valid date it will begin attempting to update the daily change tables
  function autoUpdate(){
    if(timerCount >= 61){

      //reset timerCount 
      timerCount = 0;

      let testTime  = DateTime.fromObject({ hour: 0, minute: 0 }, { zone: "America/New_York", locale: "ru" }).toString()
      let testHour  = testTime.substring(11,13)
      let validDate = false
      var nonceDate = new Date()

      //checks to see if the nonce is still valid
      if (nonce_exp < nonceDate.getTime()*1000){
        setLoggedIn(false)
      }
      
      //at midnight this will allow this function to run again.  Just incase the user leaves the app open for longer than 24 hours
      if(parseInt(testHour) == 24){
        setDataAutoUpdatedToday(false)
      }

      if(parseInt(testHour) > 17 && parseInt(testHour) < 21 && dataAutoUpdatedToday == false){
        if(dataAutoUpdatedToday == false){
          //tests to see if today is a valid day to update
          var testDate  =  new Date()
          let testDate2 =  testDate.toString()
          let year      =  testDate2.substring(11,15)
          let month     =  testDate2.substring(8,10)
          let day       =  convertMonthToNumbers(testDate2.substring(4,7))

          //getting the date for Good Friday
          let GoodFriday = formatDate(strtotime('-2 day', strtotime(getEasterDate(year))))

          testDate2 = year + '-' + month + '-' + day

          //checks to see if the date is a holiday or weekend
          validDate = isBankHoliday(testDate)
          
          //checks to see if the date matches custom dates
          if     (  
                  testDate2 == GoodFriday   ||
                  testDate2 == '2004-06-11' ||
                  testDate2 == '2007-01-02' ||
                  testDate2 == '2012-10-29' ||
                  testDate2 == '2012-10-30' ||
                  testDate2 == '2018-12-05'                         
                  ){
                  validDate = false
          }

          if(validDate == true){
            //pull lastUpdate from server and check against todays date, if it doesn't match
            getDate().then((response) => checkDate(response)).catch((error)=>{
              console.log("Api call error");
              alert(error.message);
          })  
          }

        }    
      }
    }
    timerCount++;
  }  


  //this function checks to see if todays date matches yesterdays date
  function checkDate(response){     
    setEmail(response['auth']['email']);
    setNonce(response['auth']['nonce']);
    setNonceEXP(response['auth']['nonce_exp']);
    setSessionID(response['auth']['session_id']); 
    if(lastUpdate != response){
      setDataAutoUpdatedToday(true)
      setDataLoaded(false)
      if(dataLoaded == false){
        setDateOfLastUpdate(response)
      }
    }
  }

  
  //this causes the sequence that populates the fund change table on startup, it also sets a interval for the autoupdater to run (5 minutes)
  useEffect(() => {
    //clears all the async data.  Watchlist in particular.
    if(clearPerformed == false){
      try{
        //AsyncStorage.getAllKeys().then(AsyncStorage.multiRemove)
      }catch(e){
        console.log(e)
      }
      clearPerformed = true;
    }
    loadInitialData()
    
    _interval = setInterval(
      () => autoUpdate(), 5000
    )

    registerForPushNotificationsAsync().then(token => setExpoPushToken(token));

    // This listener is fired whenever a notification is received while the app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
    });

    // This listener is fired whenever a user taps on or interacts with a notification (works when app is foregrounded, backgrounded, or killed)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      //console.log(response);
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, [])

  /*
  //this will cause a chain reaction that occurs whenever the user sets the strategy from the watchlists screen
  componentDidUpdate(prevProps, prevState) {
    let tester = watchList;
    // Typical usage (don't forget to compare props):
    watchList = props.navigation.getParam('watchLists', 'NYD');
    if(watchList != tester){
      setState({stratID: watchList}, goToStrategyPressed2(watchList))
    }     
    tester = props.navigation.getParam('watchListUpdate', 'NYD')
    if(watchListUpdater != watchList && watchListUpdater != tester){
      watchListUpdater(tester)
    }
  }
  */

  useEffect(() => {  
    if(myContext.watchListUpdate !== 'NYD'){
      goToStrategyPressed2(myContext.watchListUpdate)
    }   
  }, [myContext.watchListUpdate]);

  //this stops the interval from running, preventing memory leaks and other bugs
  function componentWillUnmount() {
    console.log("unmount performed")
    clearInterval(_interval);
  }

  function viewResponse(response){
    alert(response)
  }

  function generateMonthDropdowns(){
    let monthDisplayArray = new Array()
    for(let i = 0; i < 12; i++){
      monthDisplayArray.push(
      <View key = {'bm0' + i} style = {{flexDirection: 'column', borderWidth: 1, marginLeft: 5, marginRight: 5, marginBottom: 5, width: windowWidth - 11}}>
        <View key={'bm1' + i} style={{borderWidth: 1, alignItems: 'center', width: windowWidth - 11, height: 30, backgroundColor: '#1769AA'}}>
            {monthArray[i].split(',').map(char => <Text style = {styles.monthText} key = {char}>{char}</Text>)}
        </View>  
          <View key={'bd10' + i}>
            <View key={'bd11' + i} style = {styles.row}>              
              <Text key={'bd12' + i} style = {styles.tradeText}>1st Trade  </Text>
              <RNPickerSelect
                key={'bd13' + i}
                placeholder = {dayPlaceholder}
                value = {strategyResponse[i][0]['day']}
                onValueChange={(value) => responseHandler(value, i, 0, 'day')}
                style={{ ...pickerSelectStyles }}
                items= {Month['Array'][i]}
                useNativeAndroidPickerStyle={false}
              />
              <RNPickerSelect
                key={'bf1' + i}
                placeholder = {fundPlaceholder}
                value = {strategyResponse[i][0]['fund']}
                onValueChange={(value) => responseHandler(value, i, 0, 'fund')}
                style={{ ...pickerSelectStyles }}
                items= {Fund.Array}
                useNativeAndroidPickerStyle={false}
              />
            </View>
            <View key={'bd21' + i} style = {styles.row}>
              <Text key={'bd22' + i} style = {styles.tradeText}>2nd Trade</Text>
              <RNPickerSelect
                key={'bd23' + i}
                placeholder = {dayPlaceholder}
                value = {strategyResponse[i][1]['day']}
                onValueChange={(value) => responseHandler(value, i, 1, 'day')}
                style={{ ...pickerSelectStyles }}
                items= {Month['Array'][i]}
                useNativeAndroidPickerStyle={false}
              />
              <RNPickerSelect
                key={'bf2' + i}
                placeholder = {fundPlaceholder}
                value = {strategyResponse[i][1]['fund']}
                onValueChange={(value) => responseHandler(value, i, 1, 'fund')}
                style={{ ...pickerSelectStyles }}
                items= {Fund.Array}
                useNativeAndroidPickerStyle={false}
              />
            </View>
            <View key={'bd31' + i} style = {styles.row}>
              <Text key={'bd32' + i} style = {styles.tradeText}>G Trade    </Text>
              <RNPickerSelect
                key={'bd33' + i}
                placeholder = {dayPlaceholder}
                value = {strategyResponse[i][2]['day']}
                onValueChange={(value) => responseHandler(value, i, 2, 'day')}
                style={{ ...pickerSelectStyles }}
                items= {Month['Array'][i]}
                useNativeAndroidPickerStyle={false}
              />
            </View>
          </View>
      </View>
       )
    }
    return monthDisplayArray
  }

  function generateStrategyDropdowns(){
    let strategyDisplayArray = new Array()
    let tempName = '';
    //i < 14
    for(let i = 0; i < 14; i++){
      tempName = strategyNamesArray[i]
      strategyDisplayArray.push(        
        <View key={'strat0' + i} style = {{width: windowWidth/5}}>
          <Text key={'strat1' + i} style = {styles.switchText}>{i < 5 && tempName + ' Fund' || tempName}</Text>
          <Switch 
            key={'strat' + i}
            value    = {switchArray[i]}
            style    = {styles.switch}
            onChange = {(value) => handleSwitchChange(tempName, i)}
          />
        </View>
      )
    }
    return strategyDisplayArray
  }

  /*  put after the <ScrollView> to enable
      <LoginPopUp
      setState={p=>{setState(p)}}
      sessionHandler = {mainHandler}
      loggedIn = {loggedIn}
      email   = {emailValue}
    />
  */
  if(orientation == 'portrait'){
    return (
      <View style = {styles.mainView}>
      <ScrollView>
  
      <Text style = {styles.item2}>{emailValue}</Text>
      
      <Text style = {styles.item}>Go to Strategy: </Text>
  
      <TextInput style = {styles.input}  //this is the strategies ID input field
            underlineColorAndroid = "transparent"
            placeholder = "Enter ID#"
            placeholderTextColor = "#9a73ef"
            autoCapitalize = "none"
            onChangeText = {handleStratNum}
      />
  
      <View style = {styles.imagecontainer}>
        <Button //the go to strategy submit button
            title = 'Go'
            onPress={() => goToStrategyPressed()}
            titleStyle = {{
              color: 'white'
            }}
            buttonStyle = {{
              backgroundColor: '#1769AA',
              width: 140,
              margin: 5
            }}
            loading = {dataLoading}
            disabled = {dataLoading}
            loadingStyle = {{
              color: 'white'
            }}                                      
            type  = {'solid'}
        />
      </View>
      <Text></Text>
      
      {monthDropDowns //This is what generates all of the month drop downs
      }
  
  
      <Text></Text>
      <Text></Text>
  
      <Text style = {styles.item}>Display Benchmarks</Text>
      <View style = {styles.switchView}>
        {//0 = G, 1 = F, 2 = C, 3 = S, 4 = I, 5 = mjedlin66, 6 = Jahbulon, 7 = TSPCenter, 8 = tmj100, 9 = Matt, 10 = Jerin, 11 = Travis, 12 = Larry, 13 = Deena
        }
        {strategyDropDowns[0]}
        {strategyDropDowns[1]}
        {strategyDropDowns[2]}
        {strategyDropDowns[3]}
        {strategyDropDowns[4]}
      </View>
  
      <View style = {styles.switchView}>
        {strategyDropDowns[5]}
        {strategyDropDowns[6]}
        {strategyDropDowns[7]}
        {strategyDropDowns[8]}
      </View>
  
      <Text style = {styles.item}>Beer Bet 2020 ("There can be only one!"):</Text>
  
      <View style = {styles.switchView}>
        {strategyDropDowns[9]}
        {strategyDropDowns[10]}
        {strategyDropDowns[11]}
        {strategyDropDowns[12]}
        {strategyDropDowns[13]}                 
      </View>
  
      <Text></Text>
      <Text style = {styles.item}>Benchmark by ID:</Text>
      <TextInput style = {styles.input}  //this is the benchmark ID input field
          underlineColorAndroid = "transparent"
          placeholder = "Enter Benchmark IDs here seperated by commas"
          placeholderTextColor = "#9a73ef"
          autoCapitalize = "none"
          onChangeText = {handleID}
      />
  
    <View>
  
      <Text style = {styles.item}> For testing use: 86104, 57171 (2344 doesn't exist)</Text>
      <View style = {styles.imagecontainer}>
        <Button  //the submit button
            title = 'Submit'
            onPress={() => benchmarkPressed()}
            titleStyle = {{
              color: 'white'
            }}
            buttonStyle = {{
              backgroundColor: '#1769AA',
              width: 140,
              margin: 5
            }}
            loading = {dataLoading}
            disabled = {dataLoading}
            loadingStyle = {{
              color: 'white'
            }}                                      
            type  = {'solid'}
        />
      </View>
      <BlankSpace></BlankSpace>        
  
      </View>
      </ScrollView>
      </View>
    );      
  }
  //this dispalys the landscape data
  else{
    return (
      <View style = {styles.mainView}>
      <ScrollView>
      <Text style = {styles.item2}>{emailValue}</Text>
      
      <Text style = {styles.item}>Go to Strategy: </Text>
  
      <TextInput style = {styles.input}  //this is the strategies ID input field
            underlineColorAndroid = "transparent"
            placeholder = "Enter ID#"
            placeholderTextColor = "#9a73ef"
            autoCapitalize = "none"
            onChangeText = {handleStratNum}
      />
  
      <View style = {styles.imagecontainer}>
        <Button //the go to strategy submit button
            title = 'Go'
            onPress={() => goToStrategyPressed()}
            titleStyle = {{
              color: 'white'
            }}
            buttonStyle = {{
              backgroundColor: '#1769AA',
              width: 140,
              margin: 5
            }}
            loading = {dataLoading}
            disabled = {dataLoading}
            loadingStyle = {{
              color: 'white'
            }}                                      
            type  = {'solid'}
        />
      </View>
      <Text></Text>
      
      <View style = {{flexDirection: 'row', justifyContent: 'center'}}>
        {monthDropDowns[0]}
        {monthDropDowns[1]}
      </View>

      <View style = {{flexDirection: 'row', justifyContent: 'center'}}>
        {monthDropDowns[2]}
        {monthDropDowns[3]}
      </View>

      <View style = {{flexDirection: 'row', justifyContent: 'center'}}>
        {monthDropDowns[4]}
        {monthDropDowns[5]}
      </View>

      <View style = {{flexDirection: 'row', justifyContent: 'center'}}>
        {monthDropDowns[6]}
        {monthDropDowns[7]}
      </View>

      <View style = {{flexDirection: 'row', justifyContent: 'center'}}>
        {monthDropDowns[8]}
        {monthDropDowns[9]}
      </View>

      <View style = {{flexDirection: 'row', justifyContent: 'center'}}>
        {monthDropDowns[10]}
        {monthDropDowns[11]}
      </View>  
  
      <Text></Text>

      <View style = {styles.imagecontainer}>
        <Button //the add strategy to watchlist button
            title = 'Add to Watchlist'
            onPress={() => addStrategyPressed()}
            titleStyle = {{
              color: 'white'
            }}
            buttonStyle = {{
              backgroundColor: '#1769AA',
              width: 140,
              height: 100,
              margin: 5
            }}
            loading = {dataLoading}
            disabled = {dataLoading}
            loadingStyle = {{
              color: 'white'
            }}                                      
            type  = {'solid'}
        />
      </View>
      
      <Text></Text>
  
      <Text style = {styles.item}>Display asdfBenchmarks</Text>
      <View style = {styles.switchView}>
        {//0 = G, 1 = F, 2 = C, 3 = S, 4 = I, 5 = mjedlin66, 6 = Jahbulon, 7 = TSPCenter, 8 = tmj100, 9 = Matt, 10 = Jerin, 11 = Travis, 12 = Larry, 13 = Deena
        }
        {strategyDropDowns[0]}
        {strategyDropDowns[1]}
        {strategyDropDowns[2]}
        {strategyDropDowns[3]}
        {strategyDropDowns[4]}
      </View>
  
      <View style = {styles.switchView}>
        {strategyDropDowns[5]}
        {strategyDropDowns[6]}
        {strategyDropDowns[7]}
        {strategyDropDowns[8]}
      </View>
  
      <Text style = {styles.item}>Beer Bet 2020 ("There can be only one!"):</Text>
  
      <View style = {styles.switchView}>
        {strategyDropDowns[9]}
        {strategyDropDowns[10]}
        {strategyDropDowns[11]}
        {strategyDropDowns[12]}
        {strategyDropDowns[13]}                 
      </View>
  
      <Text></Text>
      <Text style = {styles.item}>Benchmark by ID:</Text>
      <TextInput style = {styles.input}  //this is the benchmark ID input field
          underlineColorAndroid = "transparent"
          placeholder = "Enter Benchmark IDs here seperated by commas"
          placeholderTextColor = "#9a73ef"
          autoCapitalize = "none"
          onChangeText = {handleID}
      />
  
    <View>
  
      <Text style = {styles.item}> For testing use: 86104, 57171 (2344 doesn't exist)</Text>
      <View style = {styles.imagecontainer}>
        <Button  //the submit button
            title = 'Submit'
            onPress={() => benchmarkPressed()}
            titleStyle = {{
              color: 'white'
            }}
            buttonStyle = {{
              backgroundColor: '#1769AA',
              width: 140,
              margin: 5
            }}
            loading = {dataLoading}
            disabled = {dataLoading}
            loadingStyle = {{
              color: 'white'
            }}                                      
            type  = {'solid'}
        />
      </View>
      <BlankSpace></BlankSpace>        
  
      </View>
      </ScrollView>
      </View>
    );      
  }
}    

//Styles!
const styles = StyleSheet.create({
  button: {
    backgroundColor: "#009688",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  fixedView : {
    position: 'absolute',
    left: 0,
    top: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  imagecontainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    margin: 15,
    height: 40,
    borderColor: "#148f77",
    borderWidth: 1
  },
  item: {
    textAlignVertical: "center",
    textAlign: "center",
    justifyContent: "center",
    color: "#148f77",
    margin: 10
  },
  item2: {
    textAlignVertical: "center",
    textAlign: "center",
    justifyContent: "center",
    color: "#000000",
    fontSize: 20,
    marginTop: 10
  },
  lineup: {
    flexDirection: 'row',
    flex: 1
  },
  lineupWithMargin: {
    flexDirection: 'row',
    flex: 1,
    paddingLeft: 20
  },
  mainView: {
    backgroundColor: "white"
  },
  monthText: {
    justifyContent: 'center',
    fontSize: 16,
    marginTop: 5,
     color: 'white'
  },
  row:{
    flexDirection: 'row'
  },
  switch: {
    alignSelf: 'center'
  },
  switch2: {
    padding: 30,
    marginRight: 20
  },
  switchView: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  switchView2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  switchText: {
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center'
  },
  title: {
    textAlignVertical: "center",
    textAlign: "center",
    justifyContent: "center",
    margin: 10,
    fontSize: 20
  },
  tradeText: {
    fontSize: 14, 
    paddingTop: 12,
    width: 70,
    textAlign: 'center'
  },
  trade2Text: {
    fontSize: 14, 
    paddingTop: 12,
    marginRight: 1
  },
  tradeWindows: {
    flexDirection: 'row',
    margin: 2
  }
});