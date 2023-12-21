import * as React from "react";
import { v4 as uuid } from "uuid";

export type BaseComponentType = React.ComponentType<any>;
export type WrapperProps<T extends BaseComponentType, S> = Omit<React.ComponentProps<T>, keyof S> & Partial<S>;

class GlobalState<State> {
    private _state: State;
    private _refreshWrappedComponentCollection: Record<string, () => Promise<void>>;
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
        this._state = initialState;
        this._refreshWrappedComponentCollection = {};
        this._stateWillUpdate = stateWillUpdate;
        this._stateDidUpdate = stateDidUpdate;
    }

    public withState<T extends BaseComponentType>(Component: T, stateKeys?: [keyof State, ...(keyof State)[]]) {
        const globalState = this;

        class WrappedComponent extends React.Component<WrapperProps<T, State> & { forwardedRef?: React.Ref<any> }, { stateKey: number }> {
            private _id: string;

            constructor(props: WrapperProps<T, State>) {
                super(props);

                this._id = uuid();

                this.state = {
                    stateKey: 0
                };
            }

            componentDidMount() {
                globalState._refreshWrappedComponentCollection[this._id] = () => new Promise(resolve => {
                    // No need to ensure stateKey being always incremented correctly, we only need to ensure 
                    // React refreshes the component
                    this.setState({ stateKey: this.state.stateKey + 1 }, resolve);
                });
            }

            componentWillUnmount() {
                delete globalState._refreshWrappedComponentCollection[this._id];
            }

            render() {
                const { forwardedRef, ...props } = this.props;

                // If stateKeys are specified, only pass those keys to the wrapped component
                const stateProps = stateKeys
                    ? stateKeys.reduce((state, key) => ({ ...state, [key]: globalState._state[key] }), {})
                    : globalState._state;

                // Ignoring since we're not enforcing the wrappeed component props type
                // @ts-ignore
                return <Component {...stateProps} {...props} ref={forwardedRef} />;
            }
        }

        return React.forwardRef<T, WrapperProps<T, State>>((props, ref) => <WrappedComponent {...props} forwardedRef={ref} />);
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
            const refreshComponentId = Object.keys(this._refreshWrappedComponentCollection).find(id => !refreshedComponentIds.includes(id));
            if (!refreshComponentId) {
                break;
            }

            refreshedComponentIds.push(refreshComponentId);
            await this._refreshWrappedComponentCollection[refreshComponentId]();
        }

        if (this._stateDidUpdate) {
            this._stateDidUpdate(prevState);
        }
    }
}

export default GlobalState;
