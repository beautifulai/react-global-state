import * as React from "react";
import { v4 as uuid } from "uuid";

class GlobalState<State> {
    private _state: State;
    private _reactContext: React.Context<State>;
    private _refreshProviderCollection: Record<string, () => Promise<void>>;

    /**
     * State is *NOT* mutation-safe!
     */
    public get state() {
        return this._state;
    }

    public get ContextConsumer() {
        return this._reactContext.Consumer;
    }

    /**
     * Initial state is *NOT* mutation-safe!
     */
    constructor(initialState: State) {
        this._state = initialState;
        this._reactContext = React.createContext(initialState);
        this._refreshProviderCollection = {};
    }

    public withProvider(Component: typeof React.Component<any, any>) {
        const providerWrapperId = uuid();

        return (props: React.ComponentProps<typeof Component>) => {
            const [stateKey, updateStateKey] = React.useState(0);
            const stateUpdateResolvers = React.useRef<Array<(() => void)>>([]);

            React.useEffect(() => {
                stateUpdateResolvers.current.forEach(resolve => resolve());
                stateUpdateResolvers.current = [];

                this._refreshProviderCollection[providerWrapperId] = () => new Promise(resolve => {
                    stateUpdateResolvers.current.push(resolve);
                    updateStateKey(stateKey + 1);
                });

                return () => {
                    delete this._refreshProviderCollection[providerWrapperId];
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

        await Promise.all(Object.values(this._refreshProviderCollection).map(refreshProvider => refreshProvider()))
    }
}

export default GlobalState;
