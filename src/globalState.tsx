import * as React from "react";

import { OnlyOneProviderAllowedError } from "./errors";

class GlobalState<State> {
    private _state: State;
    private _reactContext: React.Context<State>;
    private _refreshProvider: (() => Promise<void>) | null;
    private _hasProvider: boolean;

    /**
     * State is *NOT* mutation-safe!
     */
    public get state() {
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

    public withProvider(Component: typeof React.Component<any, any>) {
        if (this._hasProvider) {
            throw new OnlyOneProviderAllowedError("Only one provider is allowed");
        }

        this._hasProvider = true;

        return (props: React.ComponentProps<typeof Component>) => {
            const [stateKey, updateStateKey] = React.useState(0);
            const stateUpdateResolvers = React.useRef<Array<(() => void)>>([]);

            React.useEffect(() => {
                stateUpdateResolvers.current.forEach(resolve => resolve());
                stateUpdateResolvers.current = [];

                this._refreshProvider = () => new Promise(resolve => {
                    stateUpdateResolvers.current.push(resolve);
                    updateStateKey(stateKey + 1);
                });

                return () => {
                    this._refreshProvider = null;
                };
            }, [stateKey]);

            const { Provider } = this._reactContext;
            return <Provider value={this._state}><Component {...props} /></Provider>;
        }
    }

    public withState(Component: typeof React.Component<any, any>) {
        const { Consumer } = this._reactContext;
        return (props: React.ComponentProps<typeof Component>) => (<Consumer>{state => <Component {...props} {...state} />}</Consumer>);
    }

    public async updateState(stateUpdate: (((state: State) => State) | Partial<State>)) {
        if (typeof stateUpdate === "function") {
            this._state = stateUpdate(this._state);
        } else {
            this._state = { ...this._state, ...(stateUpdate as Partial<State>) };
        }

        if (this._refreshProvider) {
            await this._refreshProvider();
        }
    }
}

export default GlobalState;
