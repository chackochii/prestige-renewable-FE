// roles slice: role catalog + permission catalog (both runtime-editable).

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as api from "@/services/api/rolesApi";
import { logout } from "./authSlice";

const initialState = {
  roles: [],
  permissions: [],
  status: "idle",
  permissionsStatus: "idle",
  error: null,
};

const reject = (err, rejectWithValue) => rejectWithValue(err.message);

export const fetchRoles = createAsyncThunk("roles/fetchAll", async (_, { rejectWithValue }) => {
  try {
    return await api.listRoles();
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const fetchPermissions = createAsyncThunk("roles/fetchPermissions", async (_, { rejectWithValue }) => {
  try {
    return await api.listPermissions();
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const createRole = createAsyncThunk("roles/create", async (body, { rejectWithValue }) => {
  try {
    return await api.createRole(body);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const updateRole = createAsyncThunk("roles/update", async ({ code, body }, { rejectWithValue }) => {
  try {
    return await api.updateRole(code, body);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const removeRole = createAsyncThunk("roles/remove", async (code, { rejectWithValue }) => {
  try {
    await api.deleteRole(code);
    return code;
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const setRolePermissions = createAsyncThunk(
  "roles/setPermissions",
  async ({ code, permissionCodes }, { rejectWithValue }) => {
    try {
      return await api.setRolePermissions(code, permissionCodes);
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

export const createPermission = createAsyncThunk("roles/createPermission", async (body, { rejectWithValue }) => {
  try {
    return await api.createPermission(body);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const removePermission = createAsyncThunk("roles/removePermission", async (code, { rejectWithValue }) => {
  try {
    await api.deletePermission(code);
    return code;
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

const upsertRole = (state, role) => {
  const idx = state.roles.findIndex((r) => r.code === role.code);
  if (idx === -1) state.roles.push(role);
  else state.roles[idx] = role;
  state.roles.sort((a, b) => a.code.localeCompare(b.code));
};

const rolesSlice = createSlice({
  name: "roles",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoles.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchRoles.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.roles = action.payload;
      })
      .addCase(fetchRoles.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })
      .addCase(fetchPermissions.pending, (state) => {
        state.permissionsStatus = "loading";
      })
      .addCase(fetchPermissions.fulfilled, (state, action) => {
        state.permissionsStatus = "succeeded";
        state.permissions = action.payload;
      })
      .addCase(fetchPermissions.rejected, (state, action) => {
        state.permissionsStatus = "failed";
        state.error = action.payload;
      })
      .addCase(createRole.fulfilled, (state, action) => upsertRole(state, action.payload))
      .addCase(updateRole.fulfilled, (state, action) => upsertRole(state, action.payload))
      .addCase(setRolePermissions.fulfilled, (state, action) => upsertRole(state, action.payload))
      .addCase(removeRole.fulfilled, (state, action) => {
        state.roles = state.roles.filter((r) => r.code !== action.payload);
      })
      .addCase(createPermission.fulfilled, (state, action) => {
        state.permissions.push(action.payload);
        state.permissions.sort(
          (a, b) => String(a.category || "").localeCompare(String(b.category || "")) || a.code.localeCompare(b.code),
        );
      })
      .addCase(removePermission.fulfilled, (state, action) => {
        state.permissions = state.permissions.filter((p) => p.code !== action.payload);
      })
      .addCase(logout, () => initialState);
  },
});

export const selectActiveRoles = (state) => state.roles.roles.filter((r) => r.isActive);

export default rolesSlice.reducer;
