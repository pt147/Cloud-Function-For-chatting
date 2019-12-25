import * as functions from 'firebase-functions'
import admin = require('firebase-admin');

admin.initializeApp(functions.config().firebase);


export const onMessageUpdate = functions.database
    .ref('Live/users/{userId}')
    .onUpdate((change, context) => {
        const before = change.before.val()
        const after = change.after.val()

        var isNameChanged: Boolean = false
        var isProfileChanged: Boolean = false
       


        if (before.name === after.name && before.profile === after.profile) {
            return
        }


        if (before.name !== after.name) {
            isNameChanged = true
        }

        if (before.profile !== after.profile) {
            isProfileChanged = true
        }  
        
        const afterId = after.id

        const ref = change.after.ref.root.child("Live/recent_chat/");

        const promises = ref.once('value').then(snapshot => {

            snapshot.forEach((chat => {

                const refInner = ref.child("/" + chat.key + "/");

                refInner.once('value').then(snapshotInner => {

                    const updates: { [index: string]: any } = {};

                    snapshotInner.forEach((chatInner => {

                        if (chatInner.key !== null) {

                            const test: String = chatInner.key
                            console.log('chat Inner key' + test)

                            if (test.indexOf(afterId + '') >= 0) {

                                if (isProfileChanged) {
                                    updates[chatInner.key + '/profile'] = after.profile;
                                }
                                if (isNameChanged) {
                                    updates[chatInner.key + '/name'] = after.name;
                                }
                                // if (isStatusChanged) {
                                //     updates[chatInner.key + '/isOnline'] = after.isOnline;
                                // }

                            }
                        }

                    }))

                    refInner.update(updates).then(() => {
                        console.log('Successfull')
                    })
                        .catch(error => {
                            console.log('Error')
                        })

                }).catch(error => {
                    console.log('error occured.')
                })

            }))

        }).catch(error => {
            console.log('error occured.')
        })
        return promises
    })

export const onMessageAdded = functions.database

    .ref('Live/chat/{whichNodes}/{chatId}').onCreate((snapShot, context) => {

        const messageDataForUserOne = snapShot.val()
        const messageDataForUserTwo = snapShot.val()

        let userDeviceToken: string
        let nameToNotify: string

        let isBadgeAddedFirst = false
        let isBadgeAddedSecond = false
        // let user2DeviceToken: string



        const whichNodes = context.params.whichNodes


        const test: String[] = whichNodes.trim().split('_', 2);

        let updates = []


        console.log('user/' + test[1] + '/')
        const refUserInfoSecond = snapShot.ref.root.child('Live/users/' + test[0] + '/').once('value').then(model => {
            messageDataForUserTwo.name = model.val().name
            messageDataForUserTwo.profile = model.val().profile

            if (messageDataForUserTwo.receiverId + '' === test[0]) {
                userDeviceToken = model.val().device_token

                let currentChat = model.val().current_chat
                try {
                    const current_chat_split: String[] = currentChat.trim().split('_', 2);
                    if (current_chat_split.indexOf(test[1]) >= 0) {
                        isBadgeAddedFirst = false
                          } else {
                        isBadgeAddedFirst = true
                       }
                } catch (exception) {
                    console.log(exception)
                     isBadgeAddedFirst = true

                }

            } else {
                nameToNotify = model.val().name
                isBadgeAddedFirst = false
            }

        })
        const refUserInfoFirst = snapShot.ref.root.child('Live/users/' + test[1] + '/').once('value').then(UserSecondData => {
            messageDataForUserOne.name = UserSecondData.val().name
            messageDataForUserOne.profile = UserSecondData.val().profile


            if (messageDataForUserOne.receiverId + '' === test[1]) {
                userDeviceToken = UserSecondData.val().device_token

                let currentChat = UserSecondData.val().current_chat

                try {
                    const current_chat_split: String[] = currentChat.trim().split('_', 2);

                    if (current_chat_split.indexOf(test[0]) >= 0) {
                        isBadgeAddedSecond = false
                    } else {
                        isBadgeAddedSecond = true
                       }
                } catch (exception) {
                    console.log(exception)
                     isBadgeAddedSecond = true
                }


            } else {
                nameToNotify = UserSecondData.val().name
                messageDataForUserTwo.badge_count = +0
                isBadgeAddedSecond = false
            }
        })

        updates = [refUserInfoFirst, refUserInfoSecond]

        return Promise.all(updates).then(success => {

            updates = []

            const refReq1 = snapShot.ref.root.child('Live/recent_chat/' + test[0] + '/' + test[1] + '/').once('value').then(badge => {

                if (isBadgeAddedFirst) {
                    try {

                        let badgeCount = badge.val().badge_count

                        badgeCount = badgeCount + 1

                        messageDataForUserOne.badge_count = badgeCount

                    } catch (exception) {

                        messageDataForUserOne.badge_count = +1
                    }
                } else {
                    messageDataForUserOne.badge_count = +0
                }

                const ref = snapShot.ref.root.child('Live/recent_chat/' + test[0] + '/' + test[1] + '/')

                return ref.set(
                    messageDataForUserOne
                )

            })



            const refReq2 = snapShot.ref.root.child('Live/recent_chat/' + test[1] + '/' + test[0] + '/').once('value').then(badge => {

                if (isBadgeAddedSecond) {
                    try {

                        let badgeCount = badge.val().badge_count

                        badgeCount = badgeCount + 1

                        messageDataForUserTwo.badge_count = badgeCount

                    } catch (exception) {

                        messageDataForUserTwo.badge_count = +1
                    }
                } else {
                    messageDataForUserTwo.badge_count = +0
                }

                const ref = snapShot.ref.root.child('Live/recent_chat/' + test[1] + '/' + test[0] + '/')

                return ref.set(
                    messageDataForUserTwo
                )
                
            })


            var message = {
                apns: {
                    payload: {
                        aps: {
                            alert: {
                                title: "Easee",
                                body: nameToNotify + " has sent you message",
                            },
                            sound: '1',
                            badge: 1,
                        },
                        notification: {
                            senderId: messageDataForUserOne.senderId + '',
                            receiverId: messageDataForUserOne.receiverId + '',
                            notificationMessage: messageDataForUserOne.message + '',
                            name: nameToNotify,
                            notificationType: "Push"
                        }
                    }
                },
                android: {

                    data: {
                        senderId: messageDataForUserOne.senderId + '',
                        receiverId: messageDataForUserOne.receiverId + '',
                        notificationMessage: messageDataForUserOne.message + '',
                        name: nameToNotify,
                        notificationType: "Push"
                    }
                },
                token: userDeviceToken
            };

            admin.messaging().send(message).then(suc => {
                console.log('Notification send Successfuly.' + suc)
            }).catch(errorr => {
                console.log('Notification Failed.' + userDeviceToken
                )
            })

            updates = [refReq1, refReq2]

            return Promise.all(updates)

        })
    })