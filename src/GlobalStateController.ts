import GlobalState from "./GlobalState";

export default class GlobalStateController<State, ProviderProps extends JSX.IntrinsicAttributes> {
    protected _globalState: GlobalState<State, ProviderProps>;

    constructor(initialState: State) {
        this._globalState = new GlobalState<State, ProviderProps>(initialState);
    }

    protected get _state() {
        return this._globalState.state;
    }

    protected get _providerProps() {
        return this._globalState.providerProps;
    }

    protected _updateState(stateUpdate: (((state: State) => State) | Partial<State>)) {
        return this._globalState.updateState(stateUpdate);
    }

    public withProvider(Component: React.FC<ProviderProps>) {
        return this._globalState.withProvider(Component);
    }

    public withState(Component: React.FC<ProviderProps>) {
       return this._globalState.withState(Component);
    }
}
