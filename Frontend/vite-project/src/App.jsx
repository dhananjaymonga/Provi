import React from 'react'
import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import Notesup from "./Notesup"
import SetData from "./SetData"
import PuraSet from "./PuraSet"
import Ch  from "./Ch"
import Typ from "./Typ"
import Main1q from './Main1q'
function App() {
  const [count, setCount] = useState(0)

  return (
    <>
    {/* <Notesup/> */}
    {/* <SetData/> */}
    {/* <PuraSet/> */}
    {/* <Typ/>  */}
    {/* <Ch/> */}
    <Main1q/>
    </>
  )
}

export default App
