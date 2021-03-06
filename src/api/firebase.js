// @flow
import React, { Component } from 'react'
import Firebase from 'firebase'
import ReactFireMixin from 'reactfire'
import reactMixin from 'react-mixin'
import FirebaseConfig from '../config/firebase.json'
import _ from 'lodash'

export { Firebase }

type PathSpecType = {|
  path: any,
  type?: mixed,
|} | string

type PropMap = { [key: string]: PathSpecType }

Firebase.initializeApp(FirebaseConfig)
Firebase.auth()

export const firebaseRef = Firebase.database().ref()
export const firebaseAuth = Firebase.auth

const firebaseVersionRef = firebaseRef.child('schemaVersion')
const FIREBASE_SCHEMA_FORMAT = 3

export function connect(propMap: PropMap, WrappedComponent: ReactClass<any>) {
  var unmounters: Array<() => void>

  class BoundComponent extends Component {
    bindAsArray: (any, string) => void

    componentDidMount() {
        unmounters = _.map(propMap, (spec_: PathSpecType, propName) => {
            const spec = typeof spec_ === 'string' || typeof spec_ === 'function'
              ? { path: spec_ }
              : spec_
            const path = typeof spec.path === 'string' ? spec.path : spec.path(this.props)
            const ref = firebaseRef.child(path)
            if (spec.type === Array) {
                this.bindAsArray(ref, propName)
                return () => {}
            } else {
                // why not use bindAsObject here? (1) Because an earlier version that didn't handle
                // the array case, was trying to wean from reactfire. (2) Because this code might
                // still be going in a different direction.
                const listener = (snapshot) => this.setState({[propName]:  snapshot.val()})
                ref.on('value', listener, console.error)
                return () => ref.off('value', listener)
            }
        })
    }

    componentWillUnmount() {
        unmounters.forEach((fn) => fn())
    }

    render = () =>
        <WrappedComponent {...this.props} {...this.state} />
  }
  reactMixin(BoundComponent.prototype, ReactFireMixin)
  return BoundComponent
}

export function assertSchemaVersion(WrappedComponent: ReactClass<any>) {
  var listener

  return class extends Component {
    componentDidMount() {
        listener = firebaseVersionRef.on('value', (snapshot) => {
            if (snapshot.val() !== FIREBASE_SCHEMA_FORMAT) {
                window.location.reload()
            }
        })
    }

    componentWillUnmount() {
        firebaseVersionRef.off('value', listener)
    }

    render = () =>
        <WrappedComponent {...this.props} {...this.state} />
    }
  }
