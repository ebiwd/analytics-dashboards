

// Store result data as an object.
// Right now we don't use this for anything, but we could. Maybe we even save this data as a file in seperate process to the viewing...
var analyticsResults = new Object();

// various reusable icons
// var iconWarning = '<span class="icon icon-generic is-invalid-label" data-icon="l">  </span>',
var iconPrefix = '<span class="icon-indicator">',
    iconSuffix = '</span><br/>';

var iconWarning = iconPrefix + '🤔' + iconSuffix,
    iconSoSo =    iconPrefix + '😇' + iconSuffix,
    iconSuccess = iconPrefix + '🎉' + iconSuffix;

// Reusable utility functions for the analytics display
function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// allow the user to change the query
function enableUserDatePicking() {
  // set a default date
  document.getElementById("originDate").value = moment().format('YYYY-MM-DD');

  // update the report on date change
  function userChangedDate() {
    console.log('Change requested, refreshing...');
    render_queue_time = 1; // reset the processing throttle
    $('tbody.top-stories').html(''); // empty the results
    var requestDate = moment(document.getElementById("originDate").value, 'YYYY-MM-DD');
    bootstrapCustomEBIAnalytics(requestDate);
  }

  // delay the invokation of the date change to not hammer the GAPI
  var userChangedDateTimeoutID;
  $('#originDate').change( function () {
    window.clearTimeout(userChangedDateTimeoutID); // delete any pending change that occured before the timeout cleared
    userChangedDateTimeoutID = window.setTimeout(userChangedDate, 750);
  });
}

// check if the request has expired (that is: the user changed the params)
function requestIsExpired(requestDate) {
  // console.log(moment(requestDate).format('YYYY-MM-DD'),document.getElementById("originDate").value);
  if (moment(requestDate).format('YYYY-MM-DD') != document.getElementById("originDate").value) {
    // console.log('expired');
    return true; // if the dates are out of sync, request has expired
  }
  return false; // request is still valid
}

// GA...
// Load the Embed API library.
(function(w,d,s,g,js,fs){
  g=w.gapi||(w.gapi={});g.analytics={q:[],ready:function(f){this.q.push(f);}};
  js=d.createElement(s);fs=d.getElementsByTagName(s)[0];
  js.src='https://apis.google.com/js/platform.js';
  fs.parentNode.insertBefore(js,fs);js.onload=function(){g.load('analytics');};
}(window,document,'script'));

// == NOTE ==
// This code uses ES6 promises. If you want to use this code in a browser
// that doesn't supporting promises natively, you'll have to include a polyfill.
function analyticsAuthorize(clientid) {
  // Authorize the user immediately if the user has already granted access.
  // If no access has been created, render an authorize button inside the
  // element with the ID "embed-api-auth-container".
  gapi.analytics.auth.authorize({
    container: 'embed-api-auth-container',
    clientid: clientid
  });
}


/**
 * Extend the Embed APIs `gapi.analytics.report.Data` component to
 * return a promise the is fulfilled with the value returned by the API.
 * @param {Object} params The request parameters.
 * @return {Promise} A promise.
 */
function query(params) {
  return new Promise(function(resolve, reject) {
    var data = new gapi.analytics.report.Data({query: params});
    data.once('success', function(response) { resolve(response); })
        .once('error', function(response) { reject(response); })
        .execute();
  });
}


// Charting...
/**
 * Create a new canvas inside the specified element. Set it to be the width
 * and height of its container.
 * @param {string} id The id attribute of the element to host the canvas.
 * @return {RenderingContext} The 2D canvas context.
 */
function makeCanvas(id) {
  var container = document.getElementById(id);
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');

  container.innerHTML = '';
  canvas.width = container.offsetWidth;
  canvas.height = container.offsetHeight;
  container.appendChild(canvas);

  return ctx;
}


/**
 * Create a visual legend inside the specified element based off of a
 * Chart.js dataset.
 * @param {string} id The id attribute of the element to host the legend.
 * @param {Array.<Object>} items A list of labels and colors for the legend.
 */
function generateLegend(id, items) {
  var legend = document.getElementById(id);
  legend.innerHTML = items.map(function(item) {
    var color = item.color || item.strokeColor;
    var label = item.label;
    return '<li><i style="background:' + color + '"></i>' + label + '</li>';
  }).join('');
}

function setChartDefaults(){
  // Set some global Chart.js defaults.
  Chart.defaults.global.animationSteps = 60;
  Chart.defaults.global.animationEasing = 'easeInOutQuart';
  Chart.defaults.global.responsive = true;
  Chart.defaults.global.maintainAspectRatio = false;
}