import { Api } from "./Api";

const api = new Api({
	baseURL: import.meta.env.VITE_BASE_URL ,
});

export const setAuthHeader = (token: string | null) => {
	if (token) {
		api.instance.defaults.headers.common.Authorization = `Bearer ${token}`;
	} else {
		delete api.instance.defaults.headers.common.Authorization;
	}
};

export default api;
