import React from "react"
import styled, { css } from "styled-components/native"
import { Button, Text, TextInput, View, Image } from 'react-native';



export const Layout = props => (
  <Main>
    {props.children}
    <Logo  />
  </Main>
)

export const SingleBox = props => <MainBox {...props}>{props.children}</MainBox>
export const Area = props => <BoxArea {...props}>{props.children}</BoxArea>

const Logo = styled.Image`
  position: absolute;
  bottom: -10%;
  right: -10%;
  height: 90%;
  z-index: 0;
  opacity: 0.05;
`


const Main = styled.View`
  display: flex;
  flex-direction: column;
  min-height: 100;
  padding-top: 10;
  padding-bottom: 5;
  @media screen and (max-width: 640px) {
    flex-direction: column;
    padding: 0;
  }
`

const MainBox = styled.View`
  display: flex;
  flex-direction: ${props => (props.row ? "row" : "column")};
  align-items: flex-start;
  height: 30;
  max-width: ${props => (props.wide ? "70" : "35")};
  width: 100%;
  z-index: 2;
`

const BoxArea = styled.View`
  display: flex;
  flex-direction: ${props => (props.row ? "row" : "column")};
  align-items: flex-start;
  height: 10;
  max-width: ${props => (props.wide ? "70" : "35")};
  width: 100%;
  opacity: ${props => (props.active ? "1" : "1")};
  @media screen and (max-width: 640px) {
    min-width: 100vw;
    flex-direction: column;
    height: 100;
    ${props => (props.noBg ? css`padding: 1;` : null)};
  }
  z-index: 2;
`
