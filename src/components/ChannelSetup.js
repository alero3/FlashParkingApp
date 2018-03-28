import styled from "styled-components"
import { Layout, LeftContent, RightContent } from "./layout/index"
import { isGL } from "../libs/utils.js"
import {seedGen} from "../libs/utils";
import React from "react"
import { Button, Text, TextInput, View } from 'react-native';
import t from 'tcomb-form-native';
import DateTimePicker from 'react-native-modal-datetime-picker';

var { AppRegistry, TouchableHighlight } = React;



const Form = t.form.Form;

const Amount = t.struct({
    iota: t.String,
    euro: t.String,
});

const Plate = t.struct({
    plate: t.String
})




// It's the miota_amount converted in iota and rounded
export let miotasToDeposit;

export const parkingFeeEuro = 0.02;
export const miotaUnit = 1000000;

export default class extends React.Component {
  state = {
    transactions: "",
    address: "",
    deposit: "",
    euro_per_minute: parkingFeeEuro,
    miota_amount: "",
    euro_amount: "",
    exchange_rate: "",
    remaining_time: "0",
    plate: "AA000AA",
    parkingFeeIota: "",
    isDateTimePickerVisible: false

  }




  componentDidMount() {

      console.log ("channelSetup/ChannelSetup.js/comoponentDidMount...");

      this.getRateAndFee("https://api.coinmarketcap.com/v1/ticker/iota/?convert=EUR");

  }

  startChannel = (address, transactions, deposit) => {

    console.log ("index.js/reopenChannel...");
    console.log ("Plate: ", this.state.plate);

    setTimeout(() => {
      this.props.setChannel(this.state.parkingFeeIota, this.state.plate, Math.floor(miotasToDeposit*miotaUnit),
          this.state.remaining_time, this.state.exchange_rate)
    }, 500)

  }


    euroMiotaConvert = (e) => {

        var time = this.getRemainingTime(e.target.value);

        miotasToDeposit = e.target.value/this.state.exchange_rate;

        this.setState({
            euro_amount: e.target.value,
            miota_amount: e.target.value/this.state.exchange_rate,
            remaining_time: time
    });

    }

    miotaEuroConvert = (e) => {

        var time = this.getRemainingTime(e.target.value*this.state.exchange_rate);

        miotasToDeposit = e.target.value;

        this.setState({
            euro_amount: e.target.value*this.state.exchange_rate,
            miota_amount: e.target.value,
            remaining_time: time
        });
    }

    getRemainingTime = (euros) => {

        var time = euros / this.state.euro_per_minute;
        //console.log ("Time: ", time);
        time = Math.floor(time);
        //console.log ("Rounded Time: ", time);
        return time;

    }

    // Gets IOTA/EUR conversion rate and sets IOTA parking fee per minute accordingly
    getRateAndFee = (theUrl) =>
    {
        console.log ("getRateAndFee");
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.onreadystatechange = function() {
            if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
            {
                //console.log ("HTTP response: ", xmlHttp.responseText);
                var jsonResponse = JSON.parse(xmlHttp.responseText);
                //console.log ("JsonResponse: ", jsonResponse);

                var rate = jsonResponse[0].price_eur;
                console.log ("MIOTA/EUR: ", rate);

                let iotaFee = Math.floor((parkingFeeEuro / rate)*miotaUnit);
                console.log ("Parking fee per minute in IOTA: ", iotaFee);

                this.setState({
                    exchange_rate: rate,
                    parkingFeeIota: iotaFee
                });

            }
        }.bind(this);

        xmlHttp.open("GET", theUrl , true); // true for asynchronous
        xmlHttp.send(null);
    }

    changePlate = (plate) =>
    {
        this.setState({ plate: plate.target.value})
    }

    showDateTimePicker = () =>
    {

        this.setState({ isDateTimePickerVisible: true });
        console.log ("state: ", this.state.isDateTimePickerVisible)


    }


    hideDateTimePicker = () => this.setState({ isDateTimePickerVisible: false });

    handleDatePicked = (date) => {
        console.log('A date has been picked: ', date);
        this.hideDateTimePicker();
    };



  render() {
    return (

    <View>
        <Text>{"Choose how much to put in the Flash Channel"}</Text>
        <Text>{`Parking Fee: € 0.02/Minute => € 1.20/Hour`}</Text>

          <Text>{`Current exchange rate MIOTA/EUR:  `} {this.state.exchange_rate}</Text>

          {/*
          <form>
              <input type="text" name="plate" value={this.state.plate} onChange={this.changePlate} />
          </form>
          */}
          <Form ref="form" type={Plate} />

          <Text> {`How long to you plan to stay in the lot? `}</Text>

        <Button title={"Select time"}   onPress={ () => this.showDateTimePicker() }>
        </Button>


        <DateTimePicker
            isVisible={this.state.isDateTimePickerVisible}
            onConfirm={this.handleDatePicked}
            onCancel={this.hideDateTimePicker}
            mode={"datetime"}


        />

          {/*
          <form>
              <TextInput type="number" name="euros" value={this.state.euro_amount} onChange={this.euroMiotaConvert} />
              €
              <TextInput type="number" name="iotas" value={this.state.miota_amount} onChange={this.miotaEuroConvert} />
              Mi
          </form>
          */}
          <Form type={Amount} onChange={this.onChange} />
        <Text>{`With this amount you can stay in the parking lot at most for `} {this.state.remaining_time} {"minutes"}</Text>

          <Button title={"Enter the channel"}   onPress={ () => this.startChannel() }

        >
              {/*{!isGL() ? `Enable WebGL to Continue` : `Enter the Channel`}*/}
        </Button>
    </View>

    )
  }
}

