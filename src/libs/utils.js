import KJUR from "jsrsasign";
import constants from "iota.flash.js/lib/constants";

const mega = 1000000;

export const isClient =
  typeof window !== "undefined" &&
  window.document &&
  window.document.createElement

export const isGL = () => {
  if (isClient) {
    var canvas = document.createElement("canvas")
    // Get WebGLRenderingContext from canvas element.
    var gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
    // Report the result.
    if (gl && gl instanceof WebGLRenderingContext) {
      return true
    } else {
      return false
    }
  } else {
    return false
  }
}

// GET from localStorage
export const get = item => {
  return JSON.parse(localStorage.getItem(item))
}

// SET item to localStorage
export const set = (item, data) => {
  localStorage.setItem(item, JSON.stringify(data))
}
export const seedGen = length => {
  var charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ9876543210qwertyuiopasdfghjklzxcvbnm"
  var i
  var result = ""
  if (window.crypto && window.crypto.getRandomValues) {
    var values = new Uint32Array(length)
    window.crypto.getRandomValues(values)
    for (i = 0; i < length; i++) {
      result += charset[values[i] % charset.length]
    }
    return result
  } else
  {
      for (i = 0; i < length; i++)
          result += "0";

      return result

  }

}



export const httpRequest = (url) =>
{
    console.log ("http Request to server...");
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() {
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
        {
            var jsonResponse = JSON.parse(xmlHttp.responseText);
            console.log ("Returned object: ", jsonResponse);
            return jsonResponse;

        }
    }.bind(this);

    xmlHttp.open("GET", url , true); // true for asynchronous
    xmlHttp.send(null);

}


export var iotaFormatAmount = function(amount) {
    if (typeof(amount) != "integer") {
        amount = parseInt(amount, 10);
    }

    var negative, formattedAmount;
    var units = negative = formattedAmount = "", afterComma = "", beforeComma = "", hidden = "", afterCommaDigits = 0;

    if (amount < 0) {
        amount = Math.abs(amount);
        negative = "-";
    }

    /*
    1 Kiota = 10³ iota = 1,000 iota
    1 Miota = 10⁶ iota = 1,000,000 iota
    1 Giota = 10⁹ iota = 1,000,000,000 iota
    1 Tiota = 10¹² iota = 1,000,000,000,000 iota
    1 Piota = 10¹⁵ iota = 1,000,000,000,000,000 iota
    */

    if (amount >= 1000000000000000) {
        units = "Pi";
        afterCommaDigits = 15;
    } else if (amount >= 1000000000000) {
        units = "Ti";
        afterCommaDigits = 12;
    } else if (amount >= 1000000000) {
        units = "Gi";
        afterCommaDigits = 9;
    } else if (amount >= 1000000) {
        units = "Mi";
        afterCommaDigits = 6;
    } else {
        units = "i";
        afterCommaDigits = 0;
    }

    amount = amount.toString();

    var digits = amount.split("").reverse();

    for (var i=0; i<afterCommaDigits; i++) {
        afterComma = digits[i] + afterComma;
    }

    if (/^0*$/.test(afterComma)) {
        afterComma = "";
    }

    var j = 0;

    for (var i=afterCommaDigits; i<digits.length; i++) {
        if (j > 0 && j % 3 == 0) {
            beforeComma = "'" + beforeComma;
        }
        beforeComma = digits[i] + beforeComma;
        j++;
    }

    if (afterComma.length > 1) {
        hidden = afterComma.substring(1).replace(/0+$/, "");
        afterComma = afterComma[0];
    }

    var short = negative + beforeComma + (afterComma ? "." + afterComma : "") + (hidden ? "+" : "") + " " + units;
    var long  = (hidden ? short.replace("+", hidden) : "");




    return short;
}

export var toHHMM = function (minutes)
{
    var minuteInt = parseInt(minutes);
    var formattedTime;

    var hours = Math.floor(minuteInt / 60);
    var min = Math.floor(minuteInt - (hours*60));

    if (hours   < 10) {hours   = "0"+hours;}
    if (min < 10) {min = "0"+min;}

    formattedTime = hours + "h:" + min + "m";
    return formattedTime;

}
export const verifyTicketSignature = (message, publicKey) =>
{
    // Data to on which to verify signature
    var jsonData = {
        lot_id: message.ticket.lot_id,
        plate: message.ticket.plate,
        timestamp: message.ticket.timestamp,
        validity_minute: message.ticket.validity_minute,
        channel_id: message.ticket.channel_id
    };

    var data = JSON.stringify(jsonData);

    // initialize
    var verifier = new KJUR.crypto.Signature({"alg": "SHA256withRSA"});
    // initialize for signature validation
    verifier.init(publicKey); // signer's certificate
    // update data
    verifier.updateString(data);
    // verify signature
    var isValid = verifier.verify(message.ticketSignature);

    return isValid;

}

export const iotaToEuro = (iotaAmount, exchangeRate) =>
{
    var euro = iotaAmount*exchangeRate/mega;
    return euro;

}

export const getRemainingParkingTime = (iotaAmount, exchangeRate, fee) =>
{
    var euro = iotaToEuro(iotaAmount, exchangeRate);

    var time = euro / fee;
    time = Math.floor(time);
    return time;

}




