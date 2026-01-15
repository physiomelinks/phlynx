<template>
  <el-scrollbar native>
    <div class="image-container">
      <img src="../../public/phlynxlogo.svg" alt="PhLynx Logo" class="centred-image"/>
    </div>

    <el-container class="about-page">
    <el-main>
      <h1>About Physiome Links</h1>
      <p class="intro-text">
        <strong>Physiome Links (or PhLynx)</strong> is a specialised tool to streamline the coupling and editing models written in CellML.
      </p>

      <el-divider />

      <h3>The Workflow</h3>
      <p>
        This application serves as the visual frontend for the
        <strong>Circulatory Autogen</strong> project. It allows users to:
      </p>
      <ul>
        <li>Visually connect independent CellML modules.</li>
        <li>Construct cohesive system representations.</li>
        <li>
          Generate configuration files ready for parameter identification to
          calibrate to clinical data.
        </li>
      </ul>

      <p>
        For more information on the science and methodology behind the broader
        project, please visit the
        <el-link
          type="primary"
          href="https://physiomelinks.github.io/circulatory_autogen/"
          target="_blank"
        >
          Circulatory Autogen website</el-link
        >.
      </p>

      <el-divider />

      <h3>Credits & Support</h3>
      <p>
        <strong>Developed by: </strong>
        <el-link
          type="primary"
          href="https://github.com/jmdowrick"
          target="_blank"
          >Jarrah Dowrick</el-link
        >,
        <el-link type="primary" href="https://github.com/finbarargus" target="_blank"
          >Finbar Argus</el-link
        >
        &
        <el-link type="primary" href="https://github.com/hsorby" target="_blank"
          >Hugh Sorby</el-link
        >
      </p>
      <p>
        For reporting bugs or requesting features, please visit our
        <el-link
          type="primary"
          href="https://github.com/physiomelinks/phlynx"
          target="_blank"
        >
          GitHub Repository </el-link
        >.
      </p>

      <el-divider />

      <h3>License</h3>
      <p>This project is licensed under the Apache License, Version 2.0.</p>
    </el-main>
  </el-container>
  </el-scrollbar>
</template>

<style scoped>
.image-container {
  margin-top: 70px;
  display: flex; 
  justify-content: center; 
  align-items: center; 
}

.centred-image {
  width: 20%;
  height: auto;
}

.about-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  line-height: 1.6;
}

.intro-text {
  font-size: 1.1rem;
  color: #555;
}

.el-link {
  font-size: 1rem;
}

h1 {
  margin-bottom: 20px;
}
h3 {
  margin-top: 30px;
  margin-bottom: 10px;
}
ul {
  margin-bottom: 20px;
  padding-left: 20px;
}
li {
  margin-bottom: 8px;
}
</style>
