import * as React from "react";
import { v4 as uuid } from "uuid";

export type BaseComponentType = React.ComponentType<any>;
export type WrapperProps<T extends BaseComponentType, S> = Omit<React.ComponentProps<T>, keyof S> & Partial<S>;

type ProviderInjectorState = {
    stateKey: number
    providerId: string
}

export type GlobalStateStats = {
    componentsInjectingProviderCount: number,
    componentsWithInjectedStateCount: number
}

export type GlobalStateDebugProps = {
    __gs_providerInjectorState: ProviderInjectorState
    __gs_injectsProvider: boolean
}

class GlobalState<State> {
    private _reactContext: React.Context<ProviderInjectorState | null>;
    private _state: State;
    private _refreshProviderInjectorCollection: Record<string, () => Promise<void>>;
    private _stateWillUpdate?: (nextState: State) => State;
    private _stateDidUpdate?: (prevState: State) => void;
    private _componentsWithInjectedStateCollection: Record<string, string>;

    public get stats(): GlobalStateStats {
        return {
            componentsInjectingProviderCount: Object.keys(this._refreshProviderInjectorCollection).length,
            componentsWithInjectedStateCount: Object.keys(this._componentsWithInjectedStateCollection).length
        }
    }

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
        this._componentsWithInjectedStateCollection = {};
    }

    public withState<T extends BaseComponentType>(Component: T, stateKeys?: [keyof State, ...(keyof State)[]]) {
        const globalState = this;
        const { Consumer, Provider } = this._reactContext;

        type ComponentWrapperProps = WrapperProps<T, State> & GlobalStateDebugProps & { componentRef?: React.Ref<any> };
        function ComponentWrapper({ componentRef, __gs_injectsProvider, __gs_providerInjectorState, ...props }: ComponentWrapperProps) {
            const stateProps: Partial<State> = stateKeys
                ? stateKeys.reduce((_state, key) => ({ ..._state, [key]: globalState._state[key] }), {})
                : globalState._state;

            // Ignoring since we're not enforcing the wrappeed component props type
            // @ts-ignore
            return (<Component
                {...stateProps}
                {...props}
                __gs_providerInjectorState={__gs_providerInjectorState}
                __gs_injectsProvider={__gs_injectsProvider}
                ref={componentRef}
            />)
        }

        type ProviderInjectorProps = WrapperProps<T, State> & { componentRef?: React.Ref<any> };
        class ProviderInjector extends React.Component<ProviderInjectorProps, ProviderInjectorState> {
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
                return (<Provider value={this.state}>
                    <ComponentWrapper
                        {...this.props}
                        __gs_injectsProvider={true}
                        __gs_providerInjectorState={this.state}
                    />
                </Provider>);
            }
        }

        return React.forwardRef<T, WrapperProps<T, State>>((props, ref) => {
            React.useEffect(() => {
                const componentId = uuid();

                globalState._componentsWithInjectedStateCollection[componentId] = Component.displayName ?? Component.name ?? "AnonymousComponent";

                return () => {
                    delete globalState._componentsWithInjectedStateCollection[componentId];
                };
            }, []);

            return (<Consumer>
                {providerState => {
                    if (providerState === null) {
                        // No provider has been injected above this component, so we need to inject one
                        return <ProviderInjector {...props} componentRef={ref} />;
                    }

                    return (<ComponentWrapper
                        {...props}
                        componentRef={ref}
                        __gs_injectsProvider={false}
                        __gs_providerInjectorState={providerState}
                    />);
                }}
            </Consumer>);
        });
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
