import * as React from "react";
import { v4 as uuid } from "uuid";

export type BaseComponentType = keyof JSX.IntrinsicElements | React.JSXElementConstructor<any>;

class GlobalState<State> {
    private _state: State;
    private _refreshWrapperCollection: Record<string, () => Promise<void>>;
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
        this._refreshWrapperCollection = {};
        this._stateDidUpdate = stateDidUpdate;
    }

    public withState<T extends BaseComponentType>(Component: T) {
        const wrapperId = uuid();

        type WrapperProps = Omit<React.ComponentProps<T>, keyof State> & Partial<State>;
        return React.forwardRef<T, WrapperProps>((props, ref) => {
            const [stateKey, updateStateKey] = React.useState(0);
            const stateUpdateResolvers = React.useRef<Array<(() => void)>>([]);

            React.useEffect(() => {
                stateUpdateResolvers.current.forEach(resolve => resolve());
                stateUpdateResolvers.current = [];

                this._refreshWrapperCollection[wrapperId] = () => new Promise(resolve => {
                    stateUpdateResolvers.current.push(resolve);
                    updateStateKey(stateKey + 1);
                });

                return () => {
                    delete this._refreshWrapperCollection[wrapperId];
                };
            }, [stateKey]);

            // @ts-ignore
            return <Component {...this._state} {...props} ref={ref} />;
        });
    }

    public async updateState(stateUpdate: (((state: State) => State) | Partial<State>)) {
        const prevState = this._state;

        if (typeof stateUpdate === "function") {
            this._state = stateUpdate(this._state);
        } else {
            this._state = { ...this._state, ...(stateUpdate as Partial<State>) };
        }

        await Promise.all(Object.values(this._refreshWrapperCollection).map(refreshWrapper => refreshWrapper()))

        if (this._stateDidUpdate) {
            this._stateDidUpdate(prevState);
        }
    }
}

export default GlobalState;
