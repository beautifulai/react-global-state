import "normalize.css";
import "@blueprintjs/core/lib/css/blueprint.css";
import "@blueprintjs/icons/lib/css/blueprint-icons.css";

import React, { useEffect } from "react";
import styled from "styled-components";

import { Button, Intent, Card, Spinner, Tag } from "@blueprintjs/core";

// We'll be using only controller as it provides all the necessary functionality
// and wraps state and state provider/consumer
import { GlobalStateController } from "bai-react-global-state";

// Dumm styling, ignore
const AppContainer = styled.div`
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
    width: 100vw;

    >div {
        display: flex;
        justify-content: space-between;
        gap: 15px;
        width: 200px;
    }
`;

// ↓↓↓↓↓↓↓ GLOBAL STATE AND CONTROLLER ↓↓↓↓↓↓↓

// App state interface definition
interface AppState {
    fetching: boolean;
    counter: number;
}

// Defining our controller extending GlobalStateController with AppState
class AppStateController extends GlobalStateController<AppState> {
    // Initialize emulates loading
    // Note that state was initialized with fetching: true
    public async initialize() {
        // Emulating async operation
        await new Promise(resolve => setTimeout(resolve, 3000));

        // _updateState is async, it resolves when state is updated and the tree is re-rendered,
        // similar to React's setState callback
        await this._updateState({ fetching: false });
    }

    // Increments counter, emulates async operation
    public async incrementCounter() {
        // Setting fetching
        await this._updateState({ fetching: true });

        // Emulating async operation
        await new Promise(resolve => setTimeout(resolve, 500));

        // Note that _updateState is called with a state modifier function
        // similar to React's setState
        await this._updateState(({ counter, ...state }) => ({
            ...state,
            counter: counter + 1,
            fetching: false
        }));
    }
}

// Instantiating our controller with initial state
const initialState: AppState = {
    fetching: true,
    counter: 0
};
const appStateController = new AppStateController(initialState);

// ↓↓↓↓↓↓↓ REACT COMPONENTS ↓↓↓↓↓↓↓

// Main app component, injecting state provider at the top level using withProvider()
const App = appStateController.withProvider(
    // Component itself
    function App() {
        useEffect(() => {
            // Initilzing controller on mount
            appStateController.initialize()
                .catch(console.error);
        }, []);

        return (<AppContainer>
            <Card>
                {/* Being declarative here, no need to pass app state down the tree */}
                <Counter />
                {/* Note that along with the app state components may be able to receive additional props */}
                {/* In this case the component's props interface just extends AppState, refer to CounterControls definition below */}
                <CounterControls intent={Intent.SUCCESS} />
            </Card>
        </AppContainer>
        );
    }
)

const Counter =
    // State injection
    appStateController.withState(
        // Component itself
        function Counter({ counter, fetching }: AppState) {
            if (fetching) {
                return <Spinner size={25} />;
            }

            return <Tag large>{counter}</Tag>;
        }
    )

// Note that control props extend app state which means these additional props
// are supposed to be passed down by the parent component
interface CounterControlsProps extends AppState {
    intent: Intent;
}

const CounterControls =
    // State injection
    appStateController.withState(
        // Component itself
        function CounterControls({ fetching, intent }: CounterControlsProps) {
            return (<Button
                loading={fetching}
                intent={intent}
                // Note that we're directly calling controller's method here
                // as its supposed to be exposed for any callers
                onClick={() => appStateController.incrementCounter()}
                text="Increment"
            />);
        }
    )

export default App;
