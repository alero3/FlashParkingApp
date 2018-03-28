import styled from "styled-components"
import React from "react"
import connected from "../../static/connected.svg";
import disconnected from  "../../static/disconnected.svg";
import { Button, Text, TextInput, View, Image } from 'react-native';


export default props =>
  <Row border>
    <Text>
      {props.title}
    </Text>
    <Image
      src={props.serverConnected ? connected : disconnected}
      height={35}
      style={{ paddingRight: 10 }}
    />
  </Row>

const Row = styled.View`
  width: 100%;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`
