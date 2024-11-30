import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave : false})

        return {accessToken, refreshToken}
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access tokens")
    }
}

const registerUser = asyncHandler( async (req, res) => {
    const {fullName, email, username, password} = req.body

    //Check if all required fields were filled
    if (
    [fullName, email, username, password].some((fields) => 
        (fields?.trim() === "") )
    ){
        throw new ApiError(400, "All fields are required")
    }

    //check if a user with the username or email already exists
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }

    // check for images, make sure avatar is present
    const avatarLocalPath = req.files?.avatar[0]?.path;

    let coverImageLocalPath;

    if (req.files && Array.isArray(req.files.coverImage)
    && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files?.coverImage[0]?.path;
    }

    if (!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

    //Upload them to Cloudinary 
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }

    //Enter the object into the database
    const user = await User.create({
        fullName,
        avatar : avatar.url,
        coverImage : coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully!")
    )


})

const loginUser = asyncHandler( async (req, res) => {
    // Get data from req.body
    const {email, username, password} = req.body
    // Checking if at least one of username or email is entered
    if (!(username || email)) {
        throw new ApiError(400, "username or email is required")
    }
    // Checking the db for at least one of username or email
    const user = await User.findOne({
        $or : [{username}, {email}]
    })
    // Checking if the user exists 
    if (!user) {
        throw new ApiError(404, "User does not exist")
    }
    // Validating password using custom method
    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401, "Password incorrect")
    }
    // get access and refresh tokens
    const {accessToken, refreshToken} = await 
    generateAccessAndRefreshTokens(user._id)
    // getting user document without the password and refresh token
    // we have refresh token seperately 
    const loggedInUser = await User.findById(user._id).
    select("-password -refreshToken")
    // cookie options
    const options = {
        httpOnly : true,
        secure : true,
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user : loggedInUser, accessToken, 
                refreshToken
            },
            "User logged in successfully"
        )
    )

})

const logoutUser = asyncHandler( async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set : {
                refreshToken : undefined
            }
        },
        {
            new : true
        }
    )

    const options = {
        httpOnly : true,
        secure : true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"
    ))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    //Token Extraction from cookies/request body
    const incomingRefreshToken = req.cookies.refreshToken 
    || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized Request")
    }

    try {
        //Token Verification using secret
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
        //User Lookup using _id from token payload
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401, "Invalid Refresh Token")
        }
        //Refresh Token Validation
        if (incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh token is expired or used")
        }
        
        //Token Generation
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
        
        //Set Secure Cookies
        const options = {
            httpOnly : true,
            secure : true,
        }
        
        return res
        .status
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, newRefreshToken},
                "Access Token Refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message ||
            "Invalid refresh token"
        )
    }
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
}   