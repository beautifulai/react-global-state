import * as React from "react";
import { v4 as uuid } from "uuid";

export type BaseComponentType = keyof JSX.IntrinsicElements | React.JSXElementConstructor<any>;

class GlobalState<State> {
    private _state: State;
    private _refreshWrappedComponentCollection: Record<string, () => Promise<void>>;
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
    constructor(initialState: State, stateDidUpdate?: (prevState: State) => void) {
        this._state = initialState;
        this._refreshWrappedComponentCollection = {};
        this._stateDidUpdate = stateDidUpdate;
    }

    public withState<T extends BaseComponentType>(Component: T) {
        const globalState = this;

        type WrapperProps = Omit<React.ComponentProps<T>, keyof State> & Partial<State> & { forwardedRef?: React.Ref<any> };
        class WrappedComponent extends React.Component<WrapperProps, { stateKey: number }> {
            private _id: string;

            constructor(props: WrapperProps) {
                super(props);

                this._id = uuid();

                this.state = {
                    stateKey: 0
                };                
            }

            componentDidMount() {
                globalState._refreshWrappedComponentCollection[this._id] = () => new Promise(resolve => {
                    this.setState({ stateKey: this.state.stateKey + 1 }, resolve);
                });
            }

            componentWillUnmount() {
                delete globalState._refreshWrappedComponentCollection[this._id];
            }

            render() {
                const { forwardedRef, ...props } = this.props;
                // @ts-ignore
                return <Component {...globalState._state} {...props} ref={forwardedRef} />;
            }
        }

        return React.forwardRef<T, WrapperProps>((props, ref) => <WrappedComponent {...props} forwardedRef={ref} />);
    }

    public async updateState(stateUpdate: (((state: State) => State) | Partial<State>)) {
        const prevState = this._state;

        if (typeof stateUpdate === "function") {
            this._state = stateUpdate(this._state);
        } else {
            this._state = { ...this._state, ...(stateUpdate as Partial<State>) };
        }

        await Promise.all(Object.values(this._refreshWrappedComponentCollection).map(refreshComponent => refreshComponent()))

        if (this._stateDidUpdate) {
            this._stateDidUpdate(prevState);
        }
    }
}

export default GlobalState;
