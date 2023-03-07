import * as React from "react";

import { OnlyOneProviderAllowedError } from "./errors";

class GlobalState<State> {
    private _state: State;
    private _reactContext: React.Context<State>;
    private _refreshProvider: (() => void) | null;
    private _hasProvider: boolean;

    /**
     * State is *NOT* mutation-safe!
     */
    public get state(): State {
        return this._state;
    }

    /**
     * Initial state is *NOT* mutation-safe!
     */
    constructor(initialState: State) {
        this._state = initialState;
        this._reactContext = React.createContext(initialState);
        this._refreshProvider = null;
        this._hasProvider = false;
    }

    public withProvider(Component: React.FC<JSX.IntrinsicAttributes>) {
        if (this._hasProvider) {
            throw new OnlyOneProviderAllowedError("Only one provider is allowed");
        }

        this._hasProvider = true;
        return (props: JSX.IntrinsicAttributes) => {
            const [stateKey, updateStateKey] = React.useState(0);

            // This has to go right on render so it's available for the children
            // using global state on their first mount (before the useEffect is fired)
            this._refreshProvider = () => updateStateKey(stateKey + 1);

            React.useEffect(() => {
                // Only using for correct disposal upon unmount
                return () => {
                    this._refreshProvider = null;
                };
            }, [0]);

            const { Provider } = this._reactContext;
            return <Provider value={this._state}><Component {...props} /></Provider>;
        }
    }

    public withState(Component: React.FC<JSX.IntrinsicAttributes>) {
        const { Consumer } = this._reactContext;
        return (props: JSX.IntrinsicAttributes) => (<Consumer>{state => <Component {...props} {...state} />}</Consumer>);
    }

    public updateState(stateUpdate: (((state: State) => State) | Partial<State>)) {
        if (typeof stateUpdate === "function") {
            this._state = stateUpdate(this._state);
        } else {
            this._state = { ...this._state, ...(stateUpdate as Partial<State>) };
        }

        if (this._refreshProvider) {
            this._refreshProvider();
        }
    }
}

export default GlobalState;
