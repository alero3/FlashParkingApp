import styled from "styled-components/native"
import { format } from "date-fns"
import React from "react"
import { Button, Text, TextInput, View, Image } from 'react-native';



export default class extends React.Component {
  componentDidUpdate() {
    // get the messagelist container and set the scrollTop to the height of the container
    const objDiv = document.getElementById("messageList")
    objDiv.scrollTop = objDiv.scrollHeight
  }
  render() {
    return (
      <History id="messageList">
        {this.props.messages.map((item, i) => Sorter(item))}
      </History>
    )
  }
}

const Sorter = item => {
  switch (item.type) {
    case "system":
      return <System key={item.time}>{ getFormattedDate(item.time) } {item.msg}</System>
      break
    case "me":
      return (
        <MyMessage key={item.time}>
          {/* <Time>{format(item.time, "mm:ss")}</Time> */}
          {item.msg}
        </MyMessage>
      )
      break
    case "partner":
      return <Partner key={item.time}>{item.msg}</Partner>
      break

    default:
      break
  }
}

function getFormattedDate(dateString) {
    var date = new Date(dateString);
    return date.toTimeString().split(' ')[0]
    //return date.toString();
}

const Time = styled.Text`
  font-size: 10px;
  opacity: 0.6;
  margin: 0;
`

const Row = styled.View`
  width: 100%;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`

const History = styled.View`
  borderTopWidth: 2px;
  margin: 0 0 5px;
  &::-webkit-scrollbar {
    display: none;
  }
  flex: 1;
`
const System = styled.Text`
  height: 20px;
  font-size: 12px;
  text-align: left;
  color: rgba(0, 0, 0, 0.5);
  padding-bottom: 5px;
`

const MyMessage = styled.Text`
  text-align: right;
  padding: 0 1 0.3;
  color: rgba(0, 0, 0, 0.6);
`

const Partner = styled.Text`
  padding: 0 1 0.3;
`
