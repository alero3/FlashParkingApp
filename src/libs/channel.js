import { multisig, transfer } from "iota.flash.js"
import { Attach, iota } from "./iota"
import {connection, channelID, treeDepth} from "../pages/Home"
import {set, get, iotaFormatAmount, verifyTicketSignature} from "./utils"



function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


export default class Channel {
  // Security level
  static SECURITY = 2
  // Number of parties taking signing part in the channel
  static SIGNERS_COUNT = 2

  // Flash tree depth
  //static TREE_DEPTH = 5

  static flash = {}

  //TODO implement with client db
  static async isChannelAlreadyExisting(plate, parkingLot)
  {
      return null;
  }


  // Initiate the local state and store it localStorage
  static async startSetup(
    plate,
    iotaAmountInitial,
    userIndex,
    keyIndex = 0,
    security = Channel.SECURITY,
    signersCount = Channel.SIGNERS_COUNT,
    balance = Math.trunc(iotaAmountInitial)*2,
    deposit = Array(Channel.SIGNERS_COUNT).fill(iotaAmountInitial)
  ) {
    console.log ("libs/channel.js/startSetup for plate: " + plate + "...")
    console.log ("IOTA put in the channel: ", iotaAmountInitial);
    console.log ("Balance: ", balance);
    console.log ("Tree depth: ", treeDepth)

    // Escape the function when server rendering
    if (!isWindow()) return false


    var userSeed = seedGen(81);

    console.log("Initialising Channel");

    // Initialize state object
    const state = {
      userIndex: userIndex,
      userSeed: userSeed,
      keyIndex: keyIndex,
      security: security,
      depth: treeDepth,
      bundles: [],
      flash: {
        signersCount: signersCount,
        balance: balance,
        deposit: deposit,
        outputs: {},
        transfers: [],
        tickets: []
      },
      serverPublicKey: ""
    }

    await set("state", state);



      // Get a new digest
    state.partialDigests = []
    console.log ("Creating", treeDepth+1, "digests");
    console.log("Start digest creation")

      console.log ("Key Index before digest creation: ", state.keyIndex);

      for (let i = 0; i < treeDepth + 1; i++) {
        const digest = await Channel.getNewDigest()
        state.partialDigests.push(digest)
    }
    console.log("End digest creation");
    console.log ("Created client digests: ", state.partialDigests);



    // Message for server
    var msg = {
        cmd: "startSetup",
        digests: state.partialDigests,
        balance: balance,
        deposit: deposit,
        plate: plate,
        channelID: channelID
    };

    // Send the msg object as a JSON-formatted string.
    connection.send(JSON.stringify(msg));
    console.log ("Sent: ", msg.cmd);


    return new Promise((res, rej) => {
      // Create a digest object (2 people atm)
      var allDigests = []
      allDigests[state.userIndex] = state.partialDigests;

      connection.onmessage = async function (event) {

          var message = JSON.parse(event.data);

          console.log ("libs/channel.js, expecting returnSetup, received: ", message.cmd);

          if (message.cmd === "returnSetup")
          {

              state.serverPublicKey = message.publicKey;

              allDigests[message.index] = message.digests;

              // allDigest is the concatenation of clientDigest + serverDigest IN THIS ORDER!!!!

              let multisigs = state.partialDigests.map((digest, index) => {
                  let addy = multisig.composeAddress(
                      allDigests.map(userDigests => userDigests[index])
                  )
                  addy.index = digest.index
                  addy.signingIndex = state.userIndex * digest.security
                  addy.securitySum = allDigests
                      .map(userDigests => userDigests[index])
                      .reduce((acc, v) => acc + v.security, 0)
                  addy.security = digest.security
                  return addy
              })
              // Get remainder addy
              const remainderAddress = multisigs.shift()

              for (let i = 1; i < multisigs.length; i++) {
                  multisigs[i - 1].children.push(multisigs[i])
              }

              // Update root and remainder address
              state.flash.depositAddress = iota.utils.addChecksum(
                  multisigs[0].address
              )
              state.flash.remainderAddress = remainderAddress
              state.flash.root = multisigs.shift()
              state.flash.settlementAddresses = [userSeed, message.address]
              //state.flash.settlementAddresses = [message.address, userSeed]
              state.keyIndex = message.digests.length;

              console.log ("Created multisig, deposit, remainder, settlement. After that keyIndex: ", state.keyIndex);

              // Message for server
              var msg = {
                  cmd: "returnSetup",
                  return: true,
                  digests: state.partialDigests,
                  index: state.userIndex,
                  settlementAddresses: [userSeed, message.address],
                  //settlementAddresses: [message.address, userSeed],
                  channelID: channelID
              };

              // Send the msg object as a JSON-formatted string.
              connection.send(JSON.stringify(msg));
              console.log ("Sent: ", msg.cmd);


              // Update root & remainder in state
              //await store.set("state", state);
              await set("state", state);

              //events.removeListener("return")
              res(state.flash)

          }

      }


    })
  }




  static async getNewBranch(addressMultisig, generate) {
    //var state = await store.get("state");
    var state = await get("state");


      var digests = Array(generate)
      .fill()
      .map((_, i) => {
        return multisig.getDigest(state.userSeed, state.keyIndex++, state.security)
      })
    //console.log("New branch digests: ", digests)

    // Request New Branch
    var msg = {
        cmd: "getBranch",
        address: addressMultisig.address,
        digests,
        //index: state.userIndex,
        channelID: channelID
    };
    // Send the msg object as a JSON-formatted string.
    connection.send(JSON.stringify(msg));
    console.log ("Sent getBranch");

    //await store.set("state", state);
    await set("state", state);

      // Subscribe once to a get branch emitter.
    return new Promise((res, rej) => {
      var allDigests = []
      allDigests[state.userIndex] = digests;

      connection.onmessage = async function (event)
      {

          var message = JSON.parse(event.data);
          console.log ("Received: ", message.cmd);

          if (message.cmd === "returnBranch") {
              allDigests[message.userIndex] = message.digests

              let multisigs = digests.map((digest, index) => {
                  let addy = multisig.composeAddress(
                      allDigests.map(userDigests => userDigests[index])
                  )
                  addy.index = digest.index
                  addy.signingIndex = state.userIndex * digest.security
                  addy.securitySum = allDigests
                      .map(userDigests => userDigests[index])
                      .reduce((acc, v) => acc + v.security, 0)
                  addy.security = digest.security
                  return addy
              })

              // multisigs.unshift(addressMultisig)

              for (let i = 1; i < multisigs.length; i++) {
                  multisigs[i - 1].children.push(multisigs[i])
              }

              addressMultisig.children.push(multisigs[0])

              //console.log("Address Mutlisig: ", addressMultisig)
              //events.removeListener("return")


              var msg = {
                  cmd: "returnBranch",
                  digests,
                  return: true,
                  userIndex: state.userIndex,
                  channelID: channelID,
                  keyIndex: state.keyIndex
              };
              // Send the msg object as a JSON-formatted string.
              connection.send(JSON.stringify(msg));
              console.log ("Sent returnBranch");

              //await store.set("state", state);
              await set("state", state);

              res(addressMultisig)
          }
      }


    })
  }



  // Get a new digest and update index in state
  static async getNewDigest() {
    // Fetch state from localStorage
    //const state = await store.get("state");
    const state = await get("state");


      // Create new digest
    const digest = multisig.getDigest(
      state.userSeed,
      state.keyIndex,
      state.security
    )

    // Increment digests key index
    state.keyIndex++
    state.init = true

    // Update local state
    //await store.set("state", state);
    await set("state", state);

      return digest
  }

  // Initiate transaction from anywhere in the app.
  static async composeTransfer(value, settlementAddress) {

    console.log ("libs/channel.js/composeTransfer...");

    // Get latest state from localstorage
    const state = await get("state");
    //const state = await store.get("state");
    console.log ("State before starting tx: ", state);



      // TODO: check/generate tree
    if (!state.flash.root) {
        console.log ("Error: No root in flash channel");
        return
    }
    let toUse = multisig.updateLeafToRoot(state.flash.root)

    if (toUse.multisig == null)
    {
        console.log ("No more usable leaves!");
        return "noLeaves";

    }
    if (toUse.generate !== 0) {
      // Tell the server to generate new addresses, attach to the multisig you give
      await Channel.getNewBranch(toUse.multisig, toUse.generate)
      // state was modified
      //let modifiedState = await store.get("state");
      let modifiedState = await get("state");
      //let modifiedState = await store.get("state");
        console.log ("State with modified index: ", modifiedState);

        state.keyIndex = modifiedState.keyIndex
    }
    // Compose transfer
    let bundles
    try {
      // empty transfers
      let transfers
      // Map over the tx's and add the totals on
      transfers = [
        {
          value: value,
          address: settlementAddress
        }
      ]

      // No settlement addresses and userIndex is 1 (client userID is 1) as we are always sending from the client
      let newTansfers = transfer.prepare(
        state.flash.settlementAddresses,
        state.flash.deposit,
        state.userIndex,
        transfers
      )

      bundles = transfer.compose(
        state.flash.balance,
        state.flash.deposit,
        state.flash.outputs,
        toUse.multisig,
        state.flash.remainderAddress,
        state.flash.transfers,
        newTansfers
      )
    } catch (e) {
      console.log("Error: ", e)
      switch (e.message) {
        case "2":
          alert("Not enough funds")
          break
        case "4":
          alert("Incorrect bundle order")
          break
        default:
          alert("An error occured. Please reset channel")
      }
      return false
    }

    console.log ("After compose, bundles: ", bundles);

    // Sign transfer
    console.log ("Start creating signatures");
    const signatures = transfer.sign(
      toUse.multisig,
      state.userSeed,
      bundles,
      state.userIndex
    )
    console.log ("End creating signatures: ", signatures);


      var msg = {
          cmd: "composeTransfer",
          bundles,
          value,
          settlementAddress,
          index: state.userIndex,
          multisig: toUse.multisig,
          channelID: channelID
      };
      // Send the msg object as a JSON-formatted string.
      connection.send(JSON.stringify(msg));
      console.log ("Sent composeTransfer");

    // Wait for response from server
    return new Promise((res, rej) => {
      // Make counter for users
      let sigs = Array(2).fill()
      // Apply client signature to bundle
      let signedBundles = transfer.appliedSignatures(bundles, signatures);
      console.log ("Applied client signature to bundle...");

      // Start listening for messages
      connection.onmessage = async function (event)
      {

          var message = JSON.parse(event.data);
          //TODO perchè ricevo closeAccepted qui?
          console.log ("Received: ", message.cmd);

          // Server return signature for normal tx
          if (message.cmd === "returnSignature") {

              try {
                  // Add server signatures into the correct spot in the array
                  signedBundles = transfer.appliedSignatures(
                      signedBundles,
                      message.signatures
                  )
                  console.log("Attached server's signatures...");

                  // Mark off these sigs from the counter
                  sigs[message.index] = true
                  if (sigs.find(sig => !sig)) {
                      console.log("Waiting for all slots to be filled")
                  } else {
                      console.log("Bundles signed by all parties: ", signedBundles);



                      console.log("Start applyTransfers");
                      transfer.applyTransfers(
                          state.flash.root,
                          state.flash.deposit,
                          state.flash.outputs,
                          state.flash.remainderAddress,
                          state.flash.transfers,
                          signedBundles
                      )
                      console.log("End applyTransfers");

                      // Save state
                      state.bundles = signedBundles
                      //await store.set("state", state);
                      await set("state", state);


                      // Needs a share flash.
                      var msg = {
                          cmd: "returnSignature",
                          return: true,
                          signatures,
                          index: state.userIndex,
                          channelID: channelID
                      };
                      // Send the msg object as a JSON-formatted string.
                      connection.send(JSON.stringify(msg));
                      console.log("Sent returnSignature");

                      //events.removeListener("return")
                  }
              }
              catch (err) {

                  console.log (err);

              }
          }

          else if (message.cmd === "returnTicket")
          {

              var ticket = message.ticket;
              console.log ("ticket: ", ticket);

              //TODO check ticket signature
              //const RSAPublicKey = fs.readFileSync(path.join(__dirname, '../certs/public.pem'), 'utf-8')

              var isValid = verifyTicketSignature(message, state.serverPublicKey);

              if (isValid)
                  console.log("Valid ticket signature");
              else
                  console.log("Not valid ticket signature");



              state.flash.tickets.push(ticket);

              //events.removeListener("return")
              res(state)

          }
      }



    })
  }



  static close = async () => {
    console.log ("libs/channel.js/close...")
    // Get latest state from localstorage
    //const state = await store.get("state");
    const state = await get("state");

    console.log ("State before closing:");
    console.log(state);

    // TODO: check/generate tree
    if (!state.flash.root) {
      return
    }
    let toUse = multisig.updateLeafToRoot(state.flash.root);
    //console.log ("multisig toUse:", toUse);

    if (toUse.generate !== 0) {
      // Tell the server to generate new addresses, attach to the multisig you give
      const digests = await Promise.all(
        Array(toUse.generate)
          .fill()
          .map(() => Channel.getNewDigest())
      )
        console.log("digests:", digests)
      await Channel.getNewBranch(toUse.multisig, digests)
    }

    // if (toUse.generate != 0) {
    //   // Tell the server to generate new addresses, attach to the multisig you give
    //   await Channel.getNewBranch(toUse.multisig, toUse.generate)
    //   // state was modified
    //   let modifiedState = await store.get("state")
    //   state.index = modifiedState.index
    // }
    // Compose transfer
    const flash = state.flash
    let bundles
    try {
      let newTansfers = transfer.close(flash.settlementAddresses, flash.deposit);
      console.log ("newTransfers returned by transfer.close:", newTansfers);


      bundles = transfer.compose(
        flash.balance,
        flash.deposit,
        flash.outputs,
        flash.root,
        flash.remainderAddress,
        flash.transfers,
        newTansfers,
        true
      )
        console.log ("bundles returned by transfer.compose:", bundles)
    } catch (e) {
      console.log("Error: ", e)
      switch (e.message) {
        case "2":
          alert("Not enough funds")
          break
        default:
          alert("An error occured. Please reset channel")
      }
      return false
    }

    // Client signs transfer
      console.log ("Start creating signatures");
      const signatures = transfer.sign(
      state.flash.root,
      state.userSeed,
      bundles,
      state.userIndex
    )
    console.log ("End creating signatures: ", signatures);

    // Message for server
      let msg = {
          cmd: "closeChannel",
          bundles,
          index: state.userIndex,
          channelID: channelID
      };

      // Send the msg object as a JSON-formatted string.
      connection.send(JSON.stringify(msg));
      console.log ("Sent: ", msg.cmd);


    // Wait for response
    return new Promise((res, rej) => {
      // Make counter for users
      let sigs = Array(2).fill()
      // Sign your bundle initially
      let signedBundles = transfer.appliedSignatures(bundles, signatures)
        console.log ("Bundles signed only by client:")
        console.log (signedBundles)
      // Start listening for messages
        connection.onmessage = async function (event) {

            var message = JSON.parse(event.data);

            console.log ("channel.js/close Received: ", message.cmd);

            // Server return signatures for closing tx
            if (message.cmd === "returnSignature")
            {

                // Add user signatures into the correct spot in the array
                signedBundles = transfer.appliedSignatures(
                    signedBundles,
                    message.signatures
                )
                console.log ("Bundles after adding server signatures (to attach to tangle):")
                console.log (signedBundles)
                // Mark off these sigs from the counter
                sigs[message.index] = true
                if (sigs.find(sig => !sig)) {
                    console.log("Waiting for all slots to be filled")
                } else {
                    try {
                        transfer.applyTransfers(
                            flash.root,
                            flash.deposit,
                            flash.outputs,
                            flash.remainderAddress,
                            flash.transfers,
                            signedBundles
                        )
                    } catch (e) {
                        console.log("Error: ", e)
                        switch (e.message) {
                            case "4":
                                alert("Signature Error")
                                break
                            default:
                                alert("An error occured. 😂")
                        }
                        return false
                    }
                    // Save state
                    state.bundles = signedBundles
                    state.flash = flash
                    await set("state", state);
                    //await store.set("state", state);
                    console.log ("State after applyTransfers (updated flash and bundles):", state)


                    let msg = {
                        cmd: "readyForAttaching",
                        bundles: state.bundles,
                        channelID: channelID
                    };
                    // Send the msg object as a JSON-formatted string.
                    connection.send(JSON.stringify(msg));
                    console.log ("Sent readyForAttaching");

                    // Wait for server to do POW
                    connection.onmessage = async function (event) {

                        var message = JSON.parse(event.data);

                        console.log("Waiting for response after pow, Received: ", message.cmd);

                        if (message.cmd === "channelClosed") {
                            //this.setState({ channel: "main", flash: message.flash });
                            //state.channel = "main";
                            //state.flash = message.flash;
                            //console.log ("State after channelClosed (should be main): ", state);
                            console.log ("tangleBundles: ", message.tangleBundles);
                            res (message.tangleBundles);

                        }
                        else if (message.cmd === "error")
                        {
                            console.log("Returned error from attaching");
                            //state.channel = "main";
                            //state.flash = message.flash;
                            var errorMessage = "Error on POW or store";

                            rej(errorMessage);
                        }

                        //res(state);


                    }


                    //TODO rimuovere listener websocket
                    //events.removeListener("return")
                    //res(result)
                }

            }
        }

    })
  }
}

// Generate a random seed. Higher security needed
const seedGen = length => {
  var charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ9"
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
    throw new Error(
      "Your browser is outdated and can't generate secure random numbers"
    )
}

// Store class utitlizing localStorage
class Store {
  static get(item) {
    return JSON.parse(localStorage.getItem(item))
  }
  static set(item, data) {
    localStorage.setItem(item, JSON.stringify(data))
  }
}
// Check if window is available
export const isWindow = () => {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    // if (!("store" in global) || !(global.store instanceof Store)) {
    //   global.store = Store
    // }
    return false
  }
  global.store = Store
  return true
}
isWindow()
