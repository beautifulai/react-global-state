import * as React from "react";
import { v4 as uuid } from "uuid";

export type BaseComponentType = React.ComponentType<any>;
export type WrapperProps<T extends BaseComponentType, S> = Omit<React.ComponentProps<T>, keyof S> & Partial<S>;

type ProviderInjectorState = {
    stateKey: number
    providerId: string
}

class GlobalState<State> {
    private _reactContext: React.Context<ProviderInjectorState | null>;
    private _state: State;
    private _refreshProviderInjectorCollection: Record<string, () => Promise<void>>;
    private _stateWillUpdate?: (nextState: State) => State;
    private _stateDidUpdate?: (prevState: State) => void;

    /**
     * State is *NOT* mutation-safe!
     */
    public get state() {
        return this._state;
    }

    /**
     * Initial state is *NOT* mutation-safe!
     */
    constructor(
        initialState: State,
        stateWillUpdate?: (nextState: State) => State,
        stateDidUpdate?: (prevState: State) => void
    ) {
        this._reactContext = React.createContext<ProviderInjectorState | null>(null);
        this._state = initialState;
        this._refreshProviderInjectorCollection = {};
        this._stateWillUpdate = stateWillUpdate;
        this._stateDidUpdate = stateDidUpdate;
    }

    public withProvider<T extends BaseComponentType>(Component: T) {
        const globalState = this;

        type ProviderInjectorProps = React.ComponentProps<T> & { forwardedRef?: React.Ref<any> };
        class ProviderWrapper extends React.Component<ProviderInjectorProps, ProviderInjectorState> {
            constructor(props: ProviderInjectorProps) {
                super(props);

                this.state = {
                    providerId: uuid(),
                    stateKey: 0
                };
            }

            componentDidMount() {
                globalState._refreshProviderInjectorCollection[this.state.providerId] = () => new Promise(resolve => {
                    // No need to ensure stateKey being always incremented correctly, we only need to ensure 
                    // React refreshes the component
                    this.setState({ stateKey: this.state.stateKey + 1 }, resolve);
                });
            }

            componentWillUnmount() {
                delete globalState._refreshProviderInjectorCollection[this.state.providerId];
            }

            render() {
                const { forwardedRef, ...props } = this.props;

                const { Provider } = globalState._reactContext;
                return (<Provider value={this.state}>
                    {/* @ts-ignore */}
                    <Component {...props} ref={forwardedRef} />
                </Provider>);
            }
        }

        const { Consumer } = this._reactContext;
        return React.forwardRef<T, React.ComponentProps<T>>((props, ref) =>
            // Sniffing if the component is already wrapped with the provider
            <Consumer>
                {providerState => {
                    if (providerState) {
                        console.warn(`Component ${Component.name ?? "anonymous"} is already wrapped with the provider ${providerState.providerId}, will omit provider injection, please remove the redundant wrapping`);
                        // @ts-ignore
                        return <Component {...props} ref={ref} />;
                    }

                    return <ProviderWrapper {...props} forwardedRef={ref} />;
                }}
            </Consumer>
        );
    }

    public withState<T extends BaseComponentType>(Component: T, stateKeys?: [keyof State, ...(keyof State)[]]) {
        const { Consumer } = this._reactContext;

        return React.forwardRef<T, WrapperProps<T, State>>((props, ref) => (
            <Consumer>
                {providerState => {
                    if (providerState === null) {
                        throw new Error(`No state provided for component ${Component.name ?? "anonymous"}, make sure the component is wrapped with the correct provider`);
                    }

                    // If stateKeys are specified, only pass those keys to the wrapped component
                    const stateProps = stateKeys
                        ? stateKeys.reduce((_state, key) => ({ ..._state, [key]: this._state[key] }), {})
                        : this._state;

                    // Ignoring since we're not enforcing the wrappeed component props type
                    // @ts-ignore
                    return <Component
                        {...stateProps}
                        {...props}
                        // Can be used for debugging purposes
                        __providerState={providerState.stateKey}
                        ref={ref}
                    />;
                }}
            </Consumer>
        ));
    }

    /**
     * State and state updates are *NOT* mutation-safe!
     */
    public async updateState(stateUpdate: (((state: State) => State) | Partial<State>)) {
        const prevState = this._state;

        let nextState: State;
        if (typeof stateUpdate === "function") {
            nextState = stateUpdate(this._state);
        } else {
            nextState = { ...this._state, ...(stateUpdate as Partial<State>) };
        }

        if (this._stateWillUpdate) {
            nextState = this._stateWillUpdate(nextState);
            if (!nextState) {
                throw new Error("State will update hook must return next state");
            }
        }

        this._state = nextState;

        // Refreshing sequentially because some refreshes may cause new components to be mounted or existing components to be unmounted
        const refreshedComponentIds: string[] = [];
        while (true) {
            const refreshComponentId = Object.keys(this._refreshProviderInjectorCollection).find(id => !refreshedComponentIds.includes(id));
            if (!refreshComponentId) {
                break;
            }

            refreshedComponentIds.push(refreshComponentId);
            await this._refreshProviderInjectorCollection[refreshComponentId]();
        }

        if (this._stateDidUpdate) {
            this._stateDidUpdate(prevState);
        }
    }
}

export default GlobalState;
