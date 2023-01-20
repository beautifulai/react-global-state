bai-react-global-state
=====================

Redux without pain

## Install

```sh
npm install bai-react-global-state
```

## Usage

```javascript
import React from "react";
import GlobalState from "bai-react-global-state";

// Initialize global state with default value
const appState = new GlobalState({ foo: 1 });

// Simple controller that changes global state
class AppController {
    static incrementFoo() {
        appState.updateState(state => ({ foo: state.foo + 1 }));
    }
}

// Root component must be wrapped with state context provider
const App = appState.withProvider(appState.withState(
    function App({ foo }) {
        return (<div>
            <h1>{foo}</h1>
            <ChildA />
            <ChildB />
        </div>);
    }
));

// This child renders foo from global state
const ChildA = appState.withState(
    function ChildA({ foo }) {
        return <h1>{foo}</h1>;
    }
);

// This child calls the controller that increments foo from global state
function ChildB() {
    return <button onClick={() => AppController.incrementFoo()}>Increment</button>;
}

export default App;

```
