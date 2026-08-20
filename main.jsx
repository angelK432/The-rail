import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import TheRail from "./TheRail.jsx";
import { supabase } from "./supabaseClient.js";

// Backs window.storage with a per-user row in Supabase instead of the
// browser's local storage, so items persist across devices and survive
// Safari/iOS clearing home-screen app data.
function wireStorage() {
  window.storage = {
    async get(key) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
           .from("user_storage")

