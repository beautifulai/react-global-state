import * as React from "react";
import { v4 as uuid } from "uuid";

type BaseComponentType = keyof JSX.IntrinsicElements | React.JSXElementConstructor<any>;

class GlobalState<State> {
    private _state: State;
    private _reactContext: React.Context<State>;
    private _refreshProviderCollection: Record<string, () => Promise<void>>;
    private _stateDidUpdate?: (prevState: State) => void;

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
    constructor(initialState: State, stateDidUpdate?: (prevState: State) => void) {
        this._state = initialState;
        this._reactContext = React.createContext(initialState);
        this._refreshProviderCollection = {};
        this._stateDidUpdate = stateDidUpdate;
    }

    public withProvider<T extends BaseComponentType>(Component: T) {
        const providerWrapperId = uuid();

        return React.forwardRef<T, React.ComponentProps<T>>((props, ref) => {
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
            return (<Provider value={this._state}>
                {/* @ts-ignore */}
                <Component {...props} ref={ref} />
            </Provider>);
        });
    }

    public withState<T extends BaseComponentType>(Component: T) {
        const { Consumer } = this._reactContext;

        type WrapperProps = Omit<React.ComponentProps<T>, keyof State> & Partial<State>;
        return React.forwardRef<T, WrapperProps>((props, ref) => (
            <Consumer>
                {/* @ts-ignore */}
                {state => <Component {...state} {...props} ref={ref} />}
            </Consumer>
        ));
    }

    public async updateState(stateUpdate: (((state: State) => State) | Partial<State>)) {
        const prevState = this._state;

        if (typeof stateUpdate === "function") {
            this._state = stateUpdate(this._state);
        } else {
            this._state = { ...this._state, ...(stateUpdate as Partial<State>) };
        }

        await Promise.all(Object.values(this._refreshProviderCollection).map(refreshProvider => refreshProvider()))

        if (this._stateDidUpdate) {
            this._stateDidUpdate(prevState);
        }
    }
}

export default GlobalState;
