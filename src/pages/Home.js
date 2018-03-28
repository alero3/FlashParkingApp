import 'babel-polyfill';
import React, { Component } from 'react';
import { Button, Text, TextInput, View, Image } from 'react-native';
//import '../App.css';
import styled from "styled-components"
import { Area, Layout, SingleBox } from "../components/layout"
import ChannelSetup, {parkingFeeEuro} from "../components/ChannelSetup"
import History from "../components/history"
import Header from "../components/channel/header"
import {getRemainingParkingTime, iotaToEuro, seedGen, toHHMM} from "../libs/utils"
import Channel from "../libs/channel"
import { fundChannel } from "../libs/iota"
import {store} from "babel-polyfill"
import {httpRequest, iotaFormatAmount} from "../libs/utils";
import iotawhite from "../static/iota-white.png";
import loadingdark from "../static/loading-dark.svg";
import cross_icon from "../static/cross_icon.png"
import checked_icon from "../static/checked_icon.png"


// Websocket object
export var connection;
export var channelID;
export var treeDepth;
const paymentInterval = 10000;


class Home extends Component {

    static async getInitialProps({ query }) {
        return query
    }

    constructor() {
        super();
        this.parkingMeterAddress = "ws://127.0.0.1:8080";
    }

    state = {
        history: [
            { msg: "Waiting for a Parking Meter...", type: "system", time: Date.now() }
        ],
        setup: false,
        //setup: true,    //test
        serverConnected: false,
        pendingTransfer: false,
        //channel: "connectionLost",
        channel: "main",    //test
        iotaAmountInitial: "",
        flash: {transfers: [],
                deposit: [],
                outputs: {},
                settlementAddresses: []
                },
        userID: 0,
        transfer: "",
        title: `Waiting for Parking Meter to connect...`,
        channelID: "",
        exchangeRate: "",
        plate: "",
        parkingFeeIota:"0",
        remainingTime: "0",
        isOpen: "false"
    }

    paymentTimer;

    componentDidMount() {
        console.log ("pages/Home.js/componentDidMount..., flash: ", this.state.flash);

    }

    initChannel = async () => {
        console.log ("Home/initChannel");
        console.log ("Going to connect to Parking Meter...")

        connection = new WebSocket(this.parkingMeterAddress);

        connection.onopen = async () => {

            console.log ("Connected to Parking Meter on ", this.parkingMeterAddress);

            this.updateHistory({
                msg: "Connected to Parking Meter",
                type: "system",
                time: Date.now()
            })

            this.setState({
                serverConnected: true,
                channel: "loading",

            })

            var flash = await Channel.startSetup(this.state.plate, this.state.iotaAmountInitial,this.state.userID)
            //started = true
            this.setState({ flash });
            this.setState({ isOpen: true});
            console.log ("State just created: ", this.state)


            this.setState({ channel: "main" })

            // Put in tangle tx of 2000 iota to depositAddress (root)
            var deposit = await fundChannel(flash.depositAddress)
            this.updateHistory({
                msg: "Channel funded from faucet",
                type: "system",
                time: Date.now()
            })

            var msg = {
                cmd: "funded"
            };
            // Send the msg object as a JSON-formatted string.
            connection.send(JSON.stringify(msg));
            console.log ("Sent: ", msg.cmd);

            this.confirmDeposit(0);


        };

        connection.onerror = async() => {

            console.log ("Impossible to establish connection with server. Try later.");
        }

        connection.onmessage = async function (event) {

            var message = JSON.parse(event.data);

            console.log ("Home.js/initChannel, received: ", message.cmd);



            //TODO chi manda deposited??
            if (message.cmd === "deposited") {
                this.confirmDeposit(message.data.index)
                this.updateHistory({
                    msg: "Deposit address generated",
                    type: "system",
                    time: Date.now()
                })
            }


            else if (message.cmd === "message") {

                console.log ("updating History msg");
                this.updateHistory({
                    msg: message.msg,
                    type: "partner",
                    time: Date.now()
                })
            }
            else if (message.cmd === "closeChannel") {
                this.updateHistory({
                    msg: `Recieved request to close`,
                    type: "system",
                    time: Date.now()
                })
                // Get diff and set the state
                this.setState({
                    channel: "confirm",
                    pendingTransfer: {
                        close: true,
                        title: `Requesting to close the Flash Channel`,
                        bundles: message.bundles
                    }
                })
            }

            else if (message.cmd === "error") {
                this.updateHistory({
                    msg: `${message.error}`,
                    type: "system",
                    time: Date.now()
                })
                this.setState({
                    channel: "main",
                    alert: true,
                    alertText: message.error
                })
                console.log ("State after error (should be main): ", this.state);

            }

            else if (message.cmd === "serverLeft") {
                this.updateHistory({
                    msg: `${message.error}`,
                    type: "system",
                    time: Date.now()
                })
                this.setState({
                    channel: "main",
                    alert: true,
                    alertText: message.error
                })
                console.log ("State after error (should be main): ", this.state);

            }
        }

        //TODO handle server disconnection with websocket
        connection.onclose = async(event) => {

            console.log("Connection with server closed");
            console.log ("Event: ", event);

            // Normal closure
            if (event.code == 1000)
            {
                console.log ("Correct TCP closure");
                // Go to setup screen
                this.setState({
                    serverConnected: false,
                    setup: "true"
                })

            }
            // Closure with error
            else
            {
                console.log ("Abnormal TCP closure");
                this.setState({
                    serverConnected: false,
                    channel: "connectionLost"
                })


            }

            this.updateHistory({
                msg: "Parking Meter Disconnected",
                type: "system",
                time: Date.now()
            })

        }



    }

    updateHistory = data => {
        var history = this.state.history
        history.push(data)
        this.setState({ history })
    }

    sendMessage = e => {
        e.preventDefault()
        if (!this.state.message) return
        this.updateHistory({
            msg: this.state.message,
            type: "me",
            time: Date.now()
        })

        var msg = {
            cmd: "message",
            msg: this.state.message
        };
        // Send the msg object as a JSON-formatted string.
        connection.send(JSON.stringify(msg));
        console.log ("Sent: ", msg.cmd);

        this.setState({ message: "" })
    }

    sendTransaction = async (value, address) => {

        return new Promise((res, rej) =>
        {
            console.log ("Send Transaction!");
            console.log ("Value: ", value);

            if (value < 1)
            {
                console.log ("...Stop paying per second");
                clearInterval(this.paymentTimer);

                return this.setState({
                    alert: true,
                    alertText: "Please enter a positive value "
                })
            }

            if (value > this.state.flash.deposit.reduce((a, b) => a + b, 0) / 2)
            {
                console.log ("...Stop paying per second");
                clearInterval(this.paymentTimer);

                return this.setState({
                    alert: true,
                    alertText: "You can not spend more than you have"
                })
            }


            this.setState(
                {
                    channel: "payingForParking",
                    title: "Sending transaction to partner",
                    transfer: ""
                },
                async () => {

                    var state = await Channel.composeTransfer(
                        parseInt(value),
                        address
                    )

                    if (state == "noLeaves")
                    {
                        console.log ("An error occured in composeTransfer");
                        this.closeChannel();
                        res(state);

                    }

                    this.setState({ flash: state.flash })
                    console.log ("Send tx finished. State after tx:", state);

                    this.updateHistory({
                        msg: `Sent ${iotaFormatAmount(parseInt(value))} to server`,
                        type: "system",
                        time: Date.now()
                    })

                    res(state);

                }
            )


        });





    }


    // Pay per second
    repeatedSendTransaction = async (value, address) => {

        console.log ("Start paying per second...");

        this.paymentTimer = setInterval( () => this.sendTransaction(value, address), paymentInterval);
        this.sendTransaction(value, address);
        async () => {
            this.updateHistory({
                msg: `Start paying for car parking`,
                type: "system",
                time: Date.now()
            })
        }

    }

    stopSendTransaction = async() => {

        console.log ("...Stop paying per second");
        clearInterval(this.paymentTimer);
        this.setState({ channel: "main" });
        console.log ("State after stop parking: ", this.state)

    }

    payDues = async (value, settlementAddress, missingTicketsCount) => {

        console.log ("Home.js/payDues...");

        // Send missing transactions
        for (var i = 0; i < missingTicketsCount; i++)
        {
            console.log ("START SENDING TX " + i);
            await this.sendTransaction(value, settlementAddress);
            console.log ("END SENDING TX " + i);
        }

        console.log("Missing txs sent successfully");

        // After having paid my dues, try to close connection again
        let msg = {
            cmd: "closeChannelRequest",
            channelID: channelID
        };

        // Send the msg object as a JSON-formatted string.
        connection.send(JSON.stringify(msg));
        console.log ("Sent: ", msg.cmd);


    }


    closeChannel = async () => {
        console.log ("Home.js/closeChannel...")

        this.setState(
            { channel: "closed", title: "Closing the channel" },
            async () => {
                this.updateHistory({
                    msg: "Closing Channel",
                    type: "system",
                    time: Date.now()
                })

                // Message for server
                let msg = {
                    cmd: "closeChannelRequest",
                    channelID: channelID
                };
                // Send the msg object as a JSON-formatted string.
                connection.send(JSON.stringify(msg));
                console.log ("Sent: ", msg.cmd);

                var that = this;

                //TODO why it is triggered just once?
                connection.onmessage = async function (event) {

                    var message = JSON.parse(event.data);

                    console.log("Home.js/closeChannel Received: ", message.cmd);

                    if (message.cmd === "payDuesRequest")
                    {
                        // Pay dues
                        await that.payDues(parseInt(that.state.parkingFeeIota),
                            that.state.flash.settlementAddresses[that.state.userID === 0 ? 1 : 0], message.missingTicketsCount);

                    }

                    else if (message.cmd === "closeAccepted")
                    {
                        console.log ("All tickets have been paid. Server accepted my closing request");

                        // Dues have been paid. Now i can close the channel
                        var tangleBundles;
                        try
                        {
                            tangleBundles = await Channel.close();
                            // tangleBundles is supposed to be the transactionObject put in tangle
                        }
                        catch(e)
                        {
                            console.log("Error on Channel.close: ", e);
                            this.setState({
                                channel: "closed",
                                alert: true,
                                alertText: `Error when closing. Please try to close again.`
                            })

                            connection.close(1000);
                            console.log ("TCP connection closed");

                            //TODO try to close again after error
                        }

                        console.log ("Success! Returned tangleBundles from close(): ", tangleBundles);

                        this.setState({
                            channel: "closed",
                            flash: { ...this.state.flash}
                        })
                        console.log ("Client channel state is CLOSED");
                        console.log ("State after closing: ", this.state);


                        connection.close(1000);
                        console.log ("TCP connection closed");

                    }


                }


            }
        )
    }


    confirmDeposit = async index => {
        this.updateHistory({
            msg: "Deposit Completed",
            type: "system",
            time: Date.now()
        })

    }


    // Set channel according to parkingFee and data set by the car driver
    setChannel = (parkingFeeIota, plate, iotaAmountInitial, maxParkingTime, exchangeRate) => {

        // Generate random channel ID
        channelID = seedGen(10);

        // Calculate tree depth given max stop time of the customer in the parking lot
        treeDepth = Math.ceil(Math.log2(maxParkingTime));
        console.log ("maxParkingTime: " + maxParkingTime + "  => treeDepth = "+ treeDepth);

        this.setState({
            setup: true,
            parkingFeeIota: parkingFeeIota,
            channelID: channelID,
            plate: plate,
            iotaAmountInitial: iotaAmountInitial,
            remainingTime: maxParkingTime,
            exchangeRate: exchangeRate,
            channel: "loading"
        });


        this.initChannel();




    }





    // Restore TCP connection after a temporary connection loss
    reconnectTCP = async (channelID) => {

        console.log ("Home.js/reopenChannel")


        this.setState({ channel: "loading"});

        console.log ("Going to reconnect to Parking Meter...")

        connection = new WebSocket(this.parkingMeterAddress);

        connection.onopen = async () => {

            console.log("Reconnected to Parking Meter on ", this.parkingMeterAddress);

            this.updateHistory({
                msg: "Reconnected to Parking Meter",
                type: "system",
                time: Date.now()
            })

            this.setState({
                serverConnected: true,
                channel: "main"
            })
        }

        connection.onerror = async() => {

            console.log ("Impossible to reconnect with server. Try later.");
            this.setState({
                serverConnected: false,
                channel: "connectionLost"
            })
        }

    }


    // Get last ticket and total number of paid tickets
    getTicketInfo = async () =>
    {
        var request = "http://localhost:3001/tickets?" + "type=mostrecent" + "&plate=" + this.state.plate + "&lot_id=" + "ParkingLot00";
        httpRequest(request);

        request = "http://localhost:3001/tickets?" + "type=count" + "&plate=" + this.state.plate + "&lot_id=" + "ParkingLot00";
        httpRequest(request);




    }

    render() {
        var {
            history,
            title,
            serverConnected,
            setup,
            channel,
            flash,
            userID,
            exchangeRate,
            transfer,
            pendingTransfer,
            parkingFeeIota
        } = this.state
        if (!flash) var flash = { deposit: [] }
        if (!setup) {

            return (
                <View>
                        <ChannelSetup setChannel={this.setChannel} {...this.state} />
                </View>

            )
        }


        else {
            return (
                <View>



                        <View>
                            <Text> Parking Lot Name </Text>

                        {channel === "main" && (
                            <View>
                                <Text> Not Parking </Text>
                                <Image src={cross_icon} style={{width: 20}}/>
                            </View>
                        )}

                        {channel === "payingForParking" && (
                            <View>
                                <Text> Parking </Text>
                                <Image src={checked_icon} style={{width: 20}}/>
                            </View>
                        )}

                        {(channel === "main" || channel === "payingForParking" || channel === "connectionLost") && (

                            <View>

                                <Text>
                                    Price per minute:{" "}{iotaFormatAmount(parkingFeeIota)}{" / "}
                                    {parkingFeeEuro}{" €"}

                                </Text>
                                <Text>
                                    Paid so far:{" "}

                                    {flash.outputs[flash.settlementAddresses[1]] ?
                                        iotaFormatAmount(flash.outputs[flash.settlementAddresses[1]]/2)
                                        : iotaFormatAmount(0)}{" / "}
                                    {flash.outputs[flash.settlementAddresses[1]] ?
                                        iotaToEuro(flash.outputs[flash.settlementAddresses[1]]/2, exchangeRate).toFixed(2)
                                        : "0"}
                                        {" €"}

                                </Text>
                                <Text>
                                    Remaining balance:{" "}
                                    {iotaFormatAmount(flash.deposit.reduce((a, b) => a + b, 0) / 2)}{" / "}
                                    {iotaToEuro(flash.deposit.reduce((a, b) => a + b, 0) / 2, exchangeRate).toFixed(2)}
                                    {" €"}

                                </Text>
                                <Text>
                                    Your parking will expire in:{" "}
                                    {toHHMM(getRemainingParkingTime(flash.deposit.reduce((a, b) => a + b, 0) / 2, exchangeRate, parkingFeeEuro))}


                                </Text>



                            </View>
                        )}

                        {channel === "loading" && (
                            <View>
                                {/*
                                <Spinner {...this.props} src={loadingdark}/>
                                */}
                            </View>
                        )}



                            <View>

                                {channel === "main" && (
                                    <View>

                                <Button
                                    title={"Close channel"}   onPress={() => this.closeChannel()}

                                >

                                </Button>


                                <Button
                                    title={"Start Parking"}   onPress={() => this.sendTransaction(parkingFeeIota,
                                    flash.settlementAddresses[userID === 0 ? 1 : 0])}

                                >
                                </Button>

                                <Button
                                    title={"Disconnect TCP"}   onPress={ () => connection.close()}

                                >
                                </Button>

                                    </View>
                                )}

                                {channel === "payingForParking" && (
                                <Button
                                    title={"Stop Paying Per Second"}   onPress={ () => this.stopSendTransaction()}>

                                </Button>
                                )}

                                {channel === "connectionLost" && (
                                    <View>

                                        <Text>
                                            Connection lost. Please try to reconnect.

                                        </Text>

                                        <Button
                                            title={"Reconnect"}   onPress={ () => this.reconnectTCP(this.state.channelID)}
                                        >
                                        </Button>
                                    </View>
                                )}



                            </View>
                        </View>


                        {/*
                        <Right>
                            <Text>Channel History</Text>
                            <History messages={this.state.history}/>

                        </Right>
                        */}

                        </View>
            )
        }

    }
}

export default Home;

const WordLogo = styled.Image`
  position: absolute;
  top: -3.6;
  height: 3;
  left: 1;
`

const AlertBox = styled.View`
  background: white;
  position: absolute;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #222;
  text-align: center;
  &::before {
    content: "";
    position: absolute;
    right: 0;
    top: 0;
    height: 100%;
    width: 25%;
    background: rgba(232, 206, 230, 1);
  }
`

const Alert = styled.View`
  z-index: 200;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.5);
  opacity: ${props => (props.alert ? "1" : "0")};
`



const Left = styled.View`
  position: relative;
  flex: 1.7 0;
  flex-direction: column;
  height: 100%;
  padding: 10px 20px;
  @media screen and (max-width: 640px) {
    width: 100%;
    min-height: 20;
  }
`

const Right = styled.View`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  background: rgba(232, 206, 230, 1);
  padding: 10px 20px 20px;
  @media screen and (max-width: 640px) {
    width: 100%;
    min-height: 20;
  }
`

const Row = styled.View`
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
`



const Spinner = styled.Image`
  height: 5 !important;
  width: 5;
  position: absolute;
  left: 50%;
  bottom: 50%;
  margin-bottom: -2.5;
  margin-left: -2.5;
`


