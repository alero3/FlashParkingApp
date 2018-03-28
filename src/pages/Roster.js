import React, { Component } from 'react';
import logo from '../logo.svg';
import '../App.css';
import { Switch, Route } from 'react-router-dom'



class Roster extends Component {


    render() {
        return (


            <div className="App">



                <header className="App-header">
                    <img src={logo} className="App-logo" alt="logo" />
                    <h1 className="App-title">Roster route</h1>
                </header>
                <p className="App-intro">
                    To get started, edit <code>src/App.js</code> and save to reload.
                </p>

            </div>
        );
    }
}

export default Roster;
